import { NextRequest, NextResponse } from "next/server";

// Simple in-memory cache (in production, use Redis or database)
const metadataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

// SSRF protection - block private IPs
function isPrivateIP(hostname: string): boolean {
  // Check for localhost
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }

  // Check for private IP ranges
  const ipv4Regex = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
  const match = hostname.match(ipv4Regex);

  if (match) {
    const [, a, b, c, d] = match.map(Number);

    // 10.0.0.0/8
    if (a === 10) return true;

    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;

    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
  }

  return false;
}

// Extract Open Graph and Twitter Card metadata from HTML
function extractMetadata(html: string, url: string): {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
} {
  const metadata: any = {};

  // Extract OG title
  const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  const twitterTitle = html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
  metadata.title = ogTitle?.[1] || twitterTitle?.[1];

  // Extract OG description
  const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  const twitterDesc = html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i);
  const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  metadata.description = ogDesc?.[1] || twitterDesc?.[1] || metaDesc?.[1];

  // Extract OG image
  const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const twitterImage = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
  let imageUrl = ogImage?.[1] || twitterImage?.[1];

  // Make image URL absolute if relative
  if (imageUrl && !imageUrl.startsWith("http")) {
    try {
      const baseUrl = new URL(url);
      imageUrl = new URL(imageUrl, baseUrl.origin).toString();
    } catch (e) {
      // Invalid URL, ignore
      imageUrl = undefined;
    }
  }
  metadata.image = imageUrl;

  // Extract site name
  const ogSiteName = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
  metadata.siteName = ogSiteName?.[1];

  // Fallback to <title> if no og:title
  if (!metadata.title) {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    metadata.title = titleMatch?.[1];
  }

  return metadata;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      );
    }

    // Validate URL format
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return NextResponse.json(
        { error: "Only HTTP/HTTPS protocols are allowed" },
        { status: 400 }
      );
    }

    // SSRF protection - block private IPs
    if (isPrivateIP(urlObj.hostname)) {
      return NextResponse.json(
        { error: "Access to private IPs is not allowed" },
        { status: 403 }
      );
    }

    // Check cache
    const cached = metadataCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    // Fetch the page with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
        },
        redirect: "follow",
      });
    } catch (e: any) {
      clearTimeout(timeout);

      if (e.name === "AbortError") {
        return NextResponse.json(
          { error: "Request timeout" },
          { status: 408 }
        );
      }

      return NextResponse.json(
        { error: "Failed to fetch URL" },
        { status: 500 }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}` },
        { status: response.status }
      );
    }

    // Only process HTML responses
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "URL does not return HTML content" },
        { status: 400 }
      );
    }

    // Parse HTML (limit to first 500KB to prevent memory issues)
    const text = await response.text();
    const html = text.slice(0, 500000);

    // Extract metadata
    const metadata = extractMetadata(html, url);

    // Get domain and favicon
    const domain = urlObj.hostname;
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

    const result = {
      url,
      domain,
      favicon,
      title: metadata.title || domain,
      description: metadata.description,
      image: metadata.image,
      siteName: metadata.siteName,
    };

    // Cache the result
    metadataCache.set(url, { data: result, timestamp: Date.now() });

    // Clean up old cache entries (keep last 1000)
    if (metadataCache.size > 1000) {
      const entries = Array.from(metadataCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      entries.slice(0, entries.length - 1000).forEach(([key]) => {
        metadataCache.delete(key);
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Link metadata fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
