// Experience Flow Timeline (formerly "Run-of-Show Script").
//
// A landscape, print-friendly HTML document whose centerpiece is a visual
// horizontal timeline: each stage is a segment whose width is proportional to
// its estimated minutes, with the stage name above, duration below, and
// engagement intensity encoded as segment color. Per-stage detail sections
// follow beneath the timeline.
//
// Pure module: returns a complete HTML string via the shared doc wrapper.

import { buildHtmlDoc, escapeHtml } from "./html-doc";
import type {
  CXDProject,
  EngagementDistribution,
  ExperienceFlowStageV2,
} from "@/types/cxd-schema";

const ENGAGEMENT_LABELS: Record<keyof EngagementDistribution, string> = {
  observer: "Observer",
  engager: "Engager",
  coCreator: "Co-Creator",
  architect: "Architect",
};

// More agency = more intensity along the arc.
const ENGAGEMENT_WEIGHTS: Record<keyof EngagementDistribution, number> = {
  observer: 0.25,
  engager: 0.5,
  coCreator: 0.75,
  architect: 1,
};

function intensityScore(dist?: EngagementDistribution): number {
  if (!dist) return 0;
  const total = Object.values(dist).reduce((s, v) => s + (v || 0), 0);
  if (total <= 0) return 0;
  let score = 0;
  (Object.keys(ENGAGEMENT_WEIGHTS) as (keyof EngagementDistribution)[]).forEach((k) => {
    score += ((dist[k] || 0) / total) * ENGAGEMENT_WEIGHTS[k];
  });
  return score;
}

function engagementMix(dist?: EngagementDistribution): string {
  if (!dist) return "Not set";
  const parts = (Object.entries(dist) as [keyof EngagementDistribution, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${ENGAGEMENT_LABELS[k]} ${v}%`);
  return parts.length > 0 ? parts.join(" / ") : "Not set";
}

// Segment fill: a violet whose lightness deepens with engagement intensity.
function segmentColor(score: number): string {
  // score 0 -> light lavender, score 1 -> deep violet
  const light = 82 - Math.round(score * 42); // 82% down to 40%
  return `hsl(262, 68%, ${light}%)`;
}

const TIMELINE_CSS = `
  .flow-hero { margin-bottom: 8px; }
  .flow-hero h1 { font-size: 24px; }
  .flow-meta { color: var(--ink-faint); font-size: 13px; margin-bottom: 22px; }
  .flow-meta b { color: var(--ink); }

  .timeline { margin: 8px 0 34px; }
  .timeline-track {
    display: flex;
    align-items: stretch;
    gap: 4px;
    width: 100%;
  }
  .seg {
    position: relative;
    min-width: 70px;
    border-radius: 8px;
    padding: 10px 12px 12px;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 74px;
    overflow: hidden;
  }
  .seg .seg-idx {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    opacity: 0.85;
  }
  .seg .seg-name {
    font-size: 14px;
    font-weight: 650;
    line-height: 1.25;
    margin-top: 2px;
  }
  .seg .seg-dur {
    font-size: 11px;
    font-weight: 600;
    opacity: 0.92;
    margin-top: 8px;
  }
  .seg.light-seg { color: #2a2340; }
  .timeline-axis {
    height: 3px;
    background: var(--accent);
    border-radius: 2px;
    margin-top: 6px;
    opacity: 0.35;
  }
  .timeline-legend {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 12px;
    font-size: 11px;
    color: var(--ink-faint);
    flex-wrap: wrap;
  }
  .legend-scale { display: flex; align-items: center; gap: 6px; }
  .legend-swatch {
    display: inline-block;
    width: 46px; height: 10px; border-radius: 5px;
    background: linear-gradient(90deg, hsl(262,68%,82%), hsl(262,68%,40%));
  }

  .stage-detail {
    break-inside: avoid;
    border: 1px solid var(--rule);
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 14px;
  }
  .stage-detail .sd-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }
  .stage-detail .sd-title { font-size: 16px; font-weight: 650; color: var(--ink); }
  .stage-detail .sd-facts { font-size: 12px; color: var(--ink-faint); white-space: nowrap; }
  .stage-detail .sd-block { margin-top: 8px; }
  .stage-detail .sd-label {
    font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--accent); font-weight: 650; margin-bottom: 2px;
  }
  .stage-detail .sd-text { font-size: 13.5px; color: var(--ink-soft); white-space: pre-wrap; }
  .stage-detail .sd-empty { font-size: 13px; color: var(--ink-faint); font-style: italic; }
`;

export interface FlowTimelineOptions {
  /** Document color theme. Defaults to 'light' (unchanged from the original). */
  theme?: "light" | "dark";
  /** Accent hex color for the axis, labels and header rule. */
  accent?: string;
  /** Include the per-stage detail sections. When false, only the timeline shows. */
  showStageDetails?: boolean;
}

export function buildExperienceFlowTimelineHTML(
  project: CXDProject,
  stages: ExperienceFlowStageV2[],
  options: FlowTimelineOptions = {},
): string {
  const theme = options.theme === "dark" ? "dark" : "light";
  const accent = options.accent?.trim() || "#7c3aed";
  const showStageDetails = options.showStageDetails !== false;
  const projectName = project.name || project.intentionCore?.projectName || "Untitled";
  const totalMinutes = stages.reduce((s, st) => s + (st.estimatedMinutes || 0), 0);

  // Proportional widths. When durations are missing, fall back to equal weight.
  const anyDurations = stages.some((s) => (s.estimatedMinutes || 0) > 0);
  const weightTotal = anyDurations
    ? stages.reduce((s, st) => s + (st.estimatedMinutes || 0), 0)
    : stages.length;

  const segments = stages
    .map((st, i) => {
      const weight = anyDurations ? st.estimatedMinutes || 0 : 1;
      const pct = weightTotal > 0 ? Math.max((weight / weightTotal) * 100, 6) : 100 / Math.max(stages.length, 1);
      const score = intensityScore(st.engagementDistribution);
      const bg = segmentColor(score);
      const isLight = score < 0.28; // pale segments get dark text
      const dur = st.estimatedMinutes != null ? `${st.estimatedMinutes} min` : "flex";
      return `<div class="seg${isLight ? " light-seg" : ""}" style="flex:${pct.toFixed(2)} 1 0; background:${bg}">
          <div>
            <div class="seg-idx">${i + 1}</div>
            <div class="seg-name">${escapeHtml(st.name || `Stage ${i + 1}`)}</div>
          </div>
          <div class="seg-dur">${escapeHtml(dur)}</div>
        </div>`;
    })
    .join("\n");

  const details = stages
    .map((st, i) => {
      const dur = st.estimatedMinutes != null ? `${st.estimatedMinutes} min` : "Duration not set";
      const narrative = st.narrativeNotes?.trim();
      const intent = st.designIntent?.trim();
      return `<div class="stage-detail">
        <div class="sd-head">
          <div class="sd-title">${i + 1}. ${escapeHtml(st.name || `Stage ${i + 1}`)}</div>
          <div class="sd-facts">${escapeHtml(dur)} &middot; ${escapeHtml(engagementMix(st.engagementDistribution))}</div>
        </div>
        <div class="sd-block">
          <div class="sd-label">Narrative notes</div>
          ${narrative ? `<div class="sd-text">${escapeHtml(narrative)}</div>` : `<div class="sd-empty">None recorded</div>`}
        </div>
        <div class="sd-block">
          <div class="sd-label">Design intent</div>
          ${intent ? `<div class="sd-text">${escapeHtml(intent)}</div>` : `<div class="sd-empty">None recorded</div>`}
        </div>
      </div>`;
    })
    .join("\n");

  const bodyHtml = `
    <div class="flow-hero">
      <h1>Experience Flow Timeline</h1>
    </div>
    <div class="flow-meta">
      <b>${escapeHtml(String(stages.length))}</b> stages${
        totalMinutes > 0 ? ` &middot; <b>${totalMinutes} min</b> total estimated runtime` : ""
      }
    </div>

    <div class="timeline">
      <div class="timeline-track">
        ${stages.length > 0 ? segments : `<div class="seg light-seg" style="flex:1">No stages defined yet</div>`}
      </div>
      <div class="timeline-axis"></div>
      <div class="timeline-legend">
        <span>Segment width is proportional to estimated duration.</span>
        <span class="legend-scale">Engagement intensity: <span class="legend-swatch"></span> observer to architect</span>
      </div>
    </div>

    ${
      showStageDetails
        ? `<h2>Stage detail</h2>
    ${stages.length > 0 ? details : `<p>Add stages in the Experience Flow to populate this timeline.</p>`}`
        : ""
    }
  `;

  return buildHtmlDoc({
    projectName,
    artifactTitle: "Experience Flow Timeline",
    bodyHtml,
    landscape: true,
    accent,
    theme,
    extraCss: TIMELINE_CSS,
  });
}
