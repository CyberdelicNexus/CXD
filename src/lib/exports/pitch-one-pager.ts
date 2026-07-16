// Pitch One-Pager, a self-contained, print-ready HTML concept sheet.
// Opens in any browser; the user prints to PDF from there. All CSS inline,
// no external assets, dark elegant layout consistent with the CXD brand.
//
// Personalization: callers may pass PitchOptions to override the title,
// concept line, highlight bullets, contact line, accent color, and an
// embedded image. When options are omitted every field falls back to the
// project, so the default output is unchanged.

import { SENSORY_DOMAINS, REALITY_PLANES, type CXDProject } from "@/types/cxd-schema";

export interface PitchOptions {
  /** Overrides the headline title. */
  title?: string;
  /** Overrides the concept/tagline line under the title. */
  tagline?: string;
  /** Up to 3 highlight bullets. */
  highlights?: string[];
  /** Contact line shown in the footer. */
  contact?: string;
  /** Accent hex color (brand-compatible preset). */
  accent?: string;
  /** Optional image embedded as a data URI (data:image/...;base64,...). */
  imageDataUri?: string | null;
}

function esc(s: string | undefined | null): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// hex (#rrggbb) to rgba string
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(139, 92, 246, ${alpha})`;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function countElements(project: CXDProject): number {
  let n = (project.canvasLayout?.elements || []).filter(
    (el) => el.type !== "connector" && el.type !== "line",
  ).length;
  for (const board of project.canvasLayout?.boards || []) {
    n += (board.nodes || []).filter((el) => el.type !== "connector" && el.type !== "line").length;
  }
  return n;
}

function activePlanes(project: CXDProject): string[] {
  const v2 = project.realityPlanesV2;
  if (v2 && v2.length > 0) {
    return [...v2]
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority)
      .map((p) => p.code);
  }
  return REALITY_PLANES.filter((r) => (project.realityPlanes?.[r.code] ?? 0) > 0).map((r) => r.code);
}

interface LabeledValue {
  label: string;
  value: string;
}

function definitionList(items: LabeledValue[]): string {
  const filled = items.filter((i) => i.value.trim());
  if (filled.length === 0) return "";
  return filled
    .map(
      (i) => `<div class="dl-row"><div class="dl-label">${esc(i.label)}</div><div class="dl-value">${esc(i.value.trim())}</div></div>`,
    )
    .join("\n");
}

/**
 * Sensible default highlight bullets pulled from the project, used to prefill
 * the personalization form. Kept here so the UI and the export agree.
 */
export function defaultPitchHighlights(project: CXDProject): string[] {
  const candidates = [
    project.desiredChange?.insights,
    project.desiredChange?.feelings,
    project.desiredChange?.states,
    project.humanContext?.audienceNeeds,
  ];
  return candidates
    .map((c) => (c || "").trim())
    .filter((c) => c.length > 0)
    .slice(0, 3);
}

export function buildPitchHTML(project: CXDProject, options: PitchOptions = {}): string {
  const projectName =
    options.title?.trim() ||
    project.name ||
    project.intentionCore?.projectName ||
    "Untitled Experience";
  const mainConcept =
    options.tagline !== undefined
      ? options.tagline.trim()
      : project.intentionCore?.mainConcept?.trim() || "";
  const coreMessage = project.intentionCore?.coreMessage?.trim() || "";
  const generated = new Date().toISOString().split("T")[0];
  const accent = options.accent?.trim() || "#8b5cf6";
  const highlights = (options.highlights || []).map((h) => h.trim()).filter(Boolean).slice(0, 3);
  const contact = options.contact?.trim() || "";
  const image = options.imageDataUri || "";

  const changeHTML = definitionList([
    { label: "Insights", value: project.desiredChange?.insights || "" },
    { label: "Feelings", value: project.desiredChange?.feelings || "" },
    { label: "States", value: project.desiredChange?.states || "" },
    { label: "Knowledge", value: project.desiredChange?.knowledge || "" },
  ]);

  const personaHTML = definitionList([
    { label: "Their needs", value: project.humanContext?.audienceNeeds || "" },
    { label: "Their desires", value: project.humanContext?.audienceDesires || "" },
    { label: "Their role", value: project.humanContext?.userRole || "" },
  ]);

  const sensoryBars = SENSORY_DOMAINS.map((d) => {
    const v = Math.max(0, Math.min(100, project.sensoryDomains?.[d.code] ?? 0));
    return `<div class="bar-row">
        <span class="bar-label">${esc(d.label)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${v}%"></span></span>
        <span class="bar-value">${v}</span>
      </div>`;
  }).join("\n");

  const stages = project.experienceFlowStages || [];
  const totalMinutes = stages.reduce((s, st) => s + (st.estimatedMinutes || 0), 0);
  const planes = activePlanes(project);

  const stats: LabeledValue[] = [
    { label: "Design elements", value: String(countElements(project)) },
    { label: "Flow stages", value: String(stages.length) },
    ...(totalMinutes > 0 ? [{ label: "Runtime", value: `${totalMinutes} min` }] : []),
    ...(planes.length > 0 ? [{ label: "Reality planes", value: planes.join(" · ") }] : []),
  ];

  const statsHTML = stats
    .map(
      (s) => `<div class="stat"><div class="stat-value">${esc(s.value)}</div><div class="stat-label">${esc(s.label)}</div></div>`,
    )
    .join("\n");

  const highlightsHTML =
    highlights.length > 0
      ? `<div class="highlights"><h2>Highlights</h2><ul>${highlights
          .map((h) => `<li>${esc(h)}</li>`)
          .join("")}</ul></div>`
      : "";

  const imageHTML = image
    ? `<div class="hero-img"><img src="${esc(image)}" alt="${esc(projectName)}" /></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(projectName)} : Concept One-Pager</title>
<style>
  :root {
    --accent: ${accent};
    --accent-strong: ${hexToRgba(accent, 0.5)};
    --accent-soft: ${hexToRgba(accent, 0.16)};
    --accent-faint: ${hexToRgba(accent, 0.08)};
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: #09060f;
    color: #ece9f6;
    line-height: 1.5;
    padding: 40px 16px;
  }
  .page {
    max-width: 780px;
    margin: 0 auto;
    background: linear-gradient(160deg, #120b22 0%, #0c0817 55%, #0e0a1c 100%);
    border: 1px solid var(--accent-strong);
    border-radius: 18px;
    padding: 40px 48px 30px;
  }
  .kicker {
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 12px;
  }
  h1 {
    font-size: 32px;
    font-weight: 650;
    letter-spacing: -0.01em;
    background: linear-gradient(90deg, #f5f3ff, #c4b5fd);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin-bottom: 8px;
  }
  .concept { font-size: 15px; color: rgba(236, 233, 246, 0.72); max-width: 60ch; }
  .hero-img { margin: 20px 0 8px; }
  .hero-img img {
    width: 100%;
    max-height: 240px;
    object-fit: cover;
    border-radius: 12px;
    border: 1px solid var(--accent-soft);
  }
  .core {
    margin: 26px 0;
    padding: 18px 24px;
    border-left: 3px solid var(--accent);
    background: var(--accent-faint);
    border-radius: 0 12px 12px 0;
    font-size: 16px;
    font-style: italic;
    color: #ddd6fe;
  }
  h2 {
    font-size: 12px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 12px;
  }
  .highlights { margin: 24px 0; }
  .highlights ul { list-style: none; }
  .highlights li {
    position: relative;
    padding-left: 20px;
    margin-bottom: 8px;
    font-size: 14.5px;
    color: rgba(236, 233, 246, 0.86);
  }
  .highlights li::before {
    content: "";
    position: absolute;
    left: 0; top: 8px;
    width: 8px; height: 8px;
    border-radius: 2px;
    background: var(--accent);
  }
  .cols { display: flex; gap: 28px; margin-bottom: 26px; flex-wrap: wrap; }
  .col { flex: 1 1 280px; }
  .panel {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 18px 20px;
    height: 100%;
  }
  .dl-row { margin-bottom: 10px; }
  .dl-row:last-child { margin-bottom: 0; }
  .dl-label {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(196, 181, 253, 0.75);
    margin-bottom: 2px;
  }
  .dl-value { font-size: 13.5px; color: rgba(236, 233, 246, 0.88); }
  .sensory { margin-bottom: 26px; }
  .bar-row { display: flex; align-items: center; gap: 12px; margin-bottom: 7px; }
  .bar-label { width: 84px; font-size: 12px; color: rgba(236, 233, 246, 0.7); }
  .bar-track {
    flex: 1;
    height: 8px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.07);
    overflow: hidden;
  }
  .bar-fill {
    display: block;
    height: 100%;
    border-radius: 99px;
    background: linear-gradient(90deg, var(--accent), #a78bfa);
  }
  .bar-value { width: 28px; font-size: 11px; text-align: right; color: rgba(236, 233, 246, 0.5); }
  .stats { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 28px; }
  .stat {
    flex: 1 1 120px;
    background: var(--accent-faint);
    border: 1px solid var(--accent-soft);
    border-radius: 12px;
    padding: 12px 14px;
    text-align: center;
  }
  .stat-value { font-size: 19px; font-weight: 650; color: #ede9fe; }
  .stat-label {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(196, 181, 253, 0.65);
    margin-top: 3px;
  }
  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 14px;
    font-size: 11px;
    color: rgba(236, 233, 246, 0.4);
  }
  footer .brand { color: var(--accent); letter-spacing: 0.08em; }
  footer .contact { color: rgba(236, 233, 246, 0.6); }
  @media print {
    body { padding: 0; background: #09060f; }
    .page { border-radius: 0; border: none; max-width: none; padding: 24px 30px; }
    @page { size: A4 portrait; margin: 8mm; }
    .cols { margin-bottom: 18px; }
    .core, .highlights, .sensory, .stats { margin-top: 16px; margin-bottom: 16px; }
    .hero-img img { max-height: 180px; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="kicker">Experience Concept</div>
    <h1>${esc(projectName)}</h1>
    ${mainConcept ? `<p class="concept">${esc(mainConcept)}</p>` : ""}
    ${imageHTML}

    ${coreMessage ? `<div class="core">&ldquo;${esc(coreMessage)}&rdquo;</div>` : ""}

    ${highlightsHTML}

    <div class="cols">
      ${changeHTML ? `<div class="col"><div class="panel"><h2>The change we create</h2>${changeHTML}</div></div>` : ""}
      ${personaHTML ? `<div class="col"><div class="panel"><h2>Who it&rsquo;s for</h2>${personaHTML}</div></div>` : ""}
    </div>

    <div class="sensory">
      <h2>Sensory signature</h2>
      ${sensoryBars}
    </div>

    ${statsHTML ? `<div><h2>At a glance</h2><div class="stats">${statsHTML}</div></div>` : ""}

    <footer>
      <span class="brand">CXD CANVAS</span>
      ${contact ? `<span class="contact">${esc(contact)}</span>` : ""}
      <span>Concept one-pager &middot; generated ${esc(generated)}</span>
    </footer>
  </div>
</body>
</html>
`;
}
