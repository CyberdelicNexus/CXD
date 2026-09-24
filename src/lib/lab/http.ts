import { NextResponse } from "next/server";
import { labEnabled } from "./guard";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const LOOPBACK_ADDRS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Parse a Host header ("localhost:3001", "[::1]:3000"); null when unparseable or not a bare host[:port]. */
function parseHost(host: string): URL | null {
  if (!/^[a-z0-9.\-[\]:]+$/i.test(host)) return null;
  try {
    return new URL(`http://${host}`);
  } catch {
    return null;
  }
}

function forbidden(reason: string): NextResponse {
  return NextResponse.json({ error: `lab: ${reason}` }, { status: 403 });
}

/**
 * Every lab route calls this first. The lab does not exist in production (404).
 * In development it spends real money, and `next dev` listens on every
 * interface, so a request must also be local and same-origin (403 otherwise):
 * - the Host header names a loopback host (any port), which also defeats DNS rebinding;
 * - X-Forwarded-For, when present, is a loopback address (Next fills it from the
 *   socket when a client does not send one, so a plain LAN request is refused);
 * - an Origin header, when present, is that same loopback origin;
 * - Sec-Fetch-Site, when present, is not "cross-site";
 * - a mutating request carries `content-type: application/json`, which a
 *   cross-site page cannot send without a CORS preflight the lab never answers.
 */
export function labGate(request: Request): NextResponse | null {
  if (!labEnabled()) return new NextResponse("Not found", { status: 404 });

  const host = parseHost(request.headers.get("host") ?? new URL(request.url).host);
  if (!host || !LOOPBACK_HOSTS.has(host.hostname)) return forbidden("only reachable from this machine (localhost)");

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor !== null && !forwardedFor.split(",").every((a) => LOOPBACK_ADDRS.has(a.trim().toLowerCase()))) {
    return forbidden("only reachable from this machine (localhost)");
  }

  const origin = request.headers.get("origin");
  if (origin !== null) {
    let sameOrigin = false;
    try {
      const o = new URL(origin);
      sameOrigin = (o.protocol === "http:" || o.protocol === "https:") && o.host === host.host;
    } catch {
      sameOrigin = false; // includes the opaque "null" origin
    }
    if (!sameOrigin) return forbidden("cross-origin requests are refused");
  }

  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return forbidden("cross-site requests are refused");

  if (MUTATING.has(request.method.toUpperCase())) {
    const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (type !== "application/json") return forbidden("requests that change state must send content-type: application/json");
  }
  return null;
}
