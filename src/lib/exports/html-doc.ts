// Shared styled-HTML document wrapper for CXD deliverables.
//
// Non-coders should never receive a raw .md file. Every text artifact is
// rendered through buildHtmlDoc(): a self-contained, print-friendly HTML page
// with a fixed header (project name, artifact title, date), an in-page
// "Print / Save as PDF" button, and clean reading typography. Light theme by
// default because documents are printed and read, not shown on a dark canvas.
//
// Pure module: no React, no DOM. Returns a complete HTML string.

import { marked } from "marked";

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------
export function escapeHtml(s: string | undefined | null): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Markdown to HTML
// ---------------------------------------------------------------------------
// We reuse the marked dependency already in the project rather than adding one.
// The subset our generators emit (headings, bold/italic, lists, tables, links,
// paragraphs, blockquotes, hr) is fully covered by marked's GitHub-flavored
// defaults. Rendered synchronously so the wrapper stays a pure string builder.
export function markdownToHtml(md: string): string {
  const out = marked.parse(md, { async: false, gfm: true, breaks: false });
  return typeof out === "string" ? out : "";
}

// ---------------------------------------------------------------------------
// Document wrapper
// ---------------------------------------------------------------------------
export interface HtmlDocOptions {
  /** Project name, shown in the fixed header on the left. */
  projectName: string;
  /** Artifact title, e.g. "Facilitation & State-Care Sheet". */
  artifactTitle: string;
  /** Already-rendered HTML for the document body. */
  bodyHtml: string;
  /** ISO date string (defaults to today). */
  date?: string;
  /** Landscape page orientation (used by the Experience Flow Timeline). */
  landscape?: boolean;
  /** Accent hex color for header rule and headings. Defaults to CXD violet. */
  accent?: string;
  /** Extra CSS appended after the base stylesheet (for artifact-specific layout). */
  extraCss?: string;
  /** Color theme for the generated document. Defaults to 'light'. */
  theme?: "light" | "dark";
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function buildHtmlDoc(opts: HtmlDocOptions): string {
  const {
    projectName,
    artifactTitle,
    bodyHtml,
    date = todayISO(),
    landscape = false,
    accent = "#7c3aed",
    extraCss = "",
    theme = "light",
  } = opts;

  const pageSize = landscape ? "A4 landscape" : "A4";
  const contentMaxWidth = landscape ? "1180px" : "820px";

  const dark = theme === "dark";
  const t = dark
    ? {
        ink: "#ece9f6",
        inkSoft: "rgba(236,233,246,0.82)",
        inkFaint: "rgba(236,233,246,0.5)",
        rule: "rgba(255,255,255,0.1)",
        panel: "rgba(255,255,255,0.04)",
        page: "#140d24",
        bodyBg: "#09060f",
        evenRow: "rgba(255,255,255,0.02)",
      }
    : {
        ink: "#1a1626",
        inkSoft: "#4b455c",
        inkFaint: "#6f6980",
        rule: "#e7e3ef",
        panel: "#faf9fd",
        page: "#ffffff",
        bodyBg: "#f2f0f7",
        evenRow: "#fbfafe",
      };
  const printBodyBg = dark ? t.bodyBg : "#fff";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(projectName)} : ${escapeHtml(artifactTitle)}</title>
<style>
  :root {
    --accent: ${accent};
    --ink: ${t.ink};
    --ink-soft: ${t.inkSoft};
    --ink-faint: ${t.inkFaint};
    --rule: ${t.rule};
    --panel: ${t.panel};
    --page: ${t.page};
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', sans-serif;
    background: ${t.bodyBg};
    color: var(--ink);
    line-height: 1.6;
    font-size: 15px;
  }

  /* Fixed header bar */
  .doc-header {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 24px;
    background: var(--page);
    border-bottom: 2px solid var(--accent);
    box-shadow: 0 1px 8px rgba(26, 22, 38, 0.06);
  }
  .doc-header .titles { min-width: 0; }
  .doc-header .project {
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .doc-header .artifact {
    font-size: 15px;
    font-weight: 650;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .doc-header .meta {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
  }
  .doc-header .date { font-size: 12px; color: var(--ink-faint); white-space: nowrap; }
  .print-btn {
    appearance: none;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: #fff;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 7px 14px;
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
  }
  .print-btn:hover { filter: brightness(1.08); }

  /* Content */
  .doc-body {
    max-width: ${contentMaxWidth};
    margin: 0 auto;
    padding: 96px 40px 64px;
  }
  .doc-sheet {
    background: var(--page);
    border: 1px solid var(--rule);
    border-radius: 14px;
    padding: 40px 48px;
    box-shadow: 0 10px 40px rgba(26, 22, 38, 0.08);
  }

  /* Reading typography for rendered markdown */
  .doc-sheet h1 {
    font-size: 26px;
    font-weight: 700;
    color: var(--ink);
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }
  .doc-sheet h2 {
    font-size: 18px;
    font-weight: 650;
    color: var(--ink);
    margin: 28px 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--rule);
  }
  .doc-sheet h3 {
    font-size: 15px;
    font-weight: 650;
    color: var(--accent);
    margin: 20px 0 6px;
  }
  .doc-sheet h4 { font-size: 14px; font-weight: 650; margin: 14px 0 4px; }
  .doc-sheet p { margin: 0 0 12px; color: var(--ink-soft); }
  .doc-sheet strong { color: var(--ink); font-weight: 650; }
  .doc-sheet em { color: var(--ink-faint); }
  .doc-sheet ul, .doc-sheet ol { margin: 0 0 14px; padding-left: 22px; }
  .doc-sheet li { margin-bottom: 5px; color: var(--ink-soft); }
  .doc-sheet li::marker { color: var(--accent); }
  .doc-sheet a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
  .doc-sheet hr { border: none; border-top: 1px solid var(--rule); margin: 24px 0; }
  .doc-sheet blockquote {
    border-left: 3px solid var(--accent);
    background: var(--panel);
    padding: 10px 16px;
    margin: 0 0 14px;
    border-radius: 0 8px 8px 0;
    color: var(--ink-soft);
  }
  .doc-sheet code {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 0.88em;
    background: var(--panel);
    padding: 1px 5px;
    border-radius: 4px;
  }
  .doc-sheet table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 16px;
    font-size: 13.5px;
  }
  .doc-sheet th, .doc-sheet td {
    text-align: left;
    padding: 8px 12px;
    border: 1px solid var(--rule);
    vertical-align: top;
  }
  .doc-sheet th { background: var(--panel); font-weight: 650; color: var(--ink); }
  .doc-sheet tr:nth-child(even) td { background: ${t.evenRow}; }

  .doc-footer {
    max-width: ${contentMaxWidth};
    margin: 20px auto 0;
    padding: 0 40px;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--ink-faint);
  }
  .doc-footer .brand { color: var(--accent); letter-spacing: 0.08em; font-weight: 600; }

  ${extraCss}

  @media print {
    @page { size: ${pageSize}; margin: 14mm; }
    body { background: ${printBodyBg}; }
    .doc-header { position: static; box-shadow: none; }
    .print-btn { display: none !important; }
    .doc-body { padding: 16px 0 0; max-width: none; }
    .doc-sheet { border: none; border-radius: 0; box-shadow: none; padding: 0; }
    .doc-footer { padding: 0; }
  }
</style>
</head>
<body>
  <header class="doc-header">
    <div class="titles">
      <div class="project">${escapeHtml(projectName)}</div>
      <div class="artifact">${escapeHtml(artifactTitle)}</div>
    </div>
    <div class="meta">
      <span class="date">${escapeHtml(date)}</span>
      <button class="print-btn" onclick="window.print()" type="button">Print / Save as PDF</button>
    </div>
  </header>

  <main class="doc-body">
    <div class="doc-sheet">
${bodyHtml}
    </div>
  </main>

  <div class="doc-footer">
    <span class="brand">CXD CANVAS</span>
    <span>Generated ${escapeHtml(date)}</span>
  </div>
</body>
</html>
`;
}
