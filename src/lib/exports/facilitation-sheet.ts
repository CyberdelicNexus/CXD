// Facilitation & State-Care Sheet — a sober, printable markdown companion for
// whoever holds the room: designed states/traits, the intensity arc, presence
// emphasis, and fixed best-practice sections for cyberdelic facilitation.

import {
  PRESENCE_TYPES,
  STAGE_PRESENCE_TYPES,
  STATE_QUADRANTS,
  TRAIT_QUADRANTS,
  type CXDProject,
  type EngagementDistribution,
  type ExperienceFlowStageV2,
  type StagePresenceTypes,
} from "@/types/cxd-schema";

const ENGAGEMENT_LABELS: Record<keyof EngagementDistribution, string> = {
  observer: "Observer",
  engager: "Engager",
  coCreator: "Co-Creator",
  architect: "Architect",
};

// Weighted engagement score (0–1): more agency = more intensity to hold.
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

function intensityBar(score: number): string {
  const filled = Math.round(score * 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function engagementMix(dist?: EngagementDistribution): string {
  if (!dist) return "Not set";
  const parts = (Object.entries(dist) as [keyof EngagementDistribution, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${ENGAGEMENT_LABELS[k]} ${v}%`);
  return parts.length > 0 ? parts.join(" · ") : "Not set";
}

function presenceEmphasis(presence?: StagePresenceTypes): string {
  if (!presence) return "Not set";
  const top = (Object.entries(presence) as [keyof StagePresenceTypes, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k, v]) => {
      const label = STAGE_PRESENCE_TYPES.find((p) => p.code === k)?.label || k;
      return `${label} ${v}`;
    });
  return top.length > 0 ? top.join(" · ") : "Not set";
}

function quadrantLines(
  quadrants: { code: string; label: string; description: string }[],
  values: Record<string, string> | undefined,
): string[] {
  return quadrants.map((q) => {
    const v = values?.[q.code]?.trim();
    return `- **${q.label}** _(${q.description})_: ${v || "_Not specified_"}`;
  });
}

export interface FacilitationSheetOptions {
  /** Designed states & intended traits quadrants. Defaults to true. */
  includeStatesTraits?: boolean;
  /** Intensity/engagement curve table plus per-stage notes. Defaults to true. */
  includeIntensityCurve?: boolean;
  /** Overall presence profile breakdown. Defaults to true. */
  includePresenceProfile?: boolean;
  /** Fixed best-practice blocks: consent & opt-out, grounding techniques, integration prompts. Defaults to true. */
  includeConsentGroundingIntegration?: boolean;
}

export function buildFacilitationMarkdown(
  project: CXDProject,
  stages: ExperienceFlowStageV2[],
  options: FacilitationSheetOptions = {},
): string {
  const includeStatesTraits = options.includeStatesTraits !== false;
  const includeIntensityCurve = options.includeIntensityCurve !== false;
  const includePresenceProfile = options.includePresenceProfile !== false;
  const includeConsentGroundingIntegration = options.includeConsentGroundingIntegration !== false;

  const projectName = project.name || project.intentionCore?.projectName || "Untitled";
  const generated = new Date().toISOString().split("T")[0];
  const totalMinutes = stages.reduce((s, st) => s + (st.estimatedMinutes || 0), 0);

  const lines: string[] = [];
  lines.push(`# Facilitation & State-Care Sheet: ${projectName}`);
  lines.push("");
  lines.push(`_Generated ${generated}_`);
  lines.push("");
  lines.push(
    "For the facilitation team. This sheet describes the states this experience is designed to evoke, where intensity concentrates, and how to hold participants safely before, during and after.",
  );
  lines.push("");
  lines.push("---");
  lines.push("");

  if (includeStatesTraits) {
    // Designed states
    lines.push("## Designed states (transient, during the experience)");
    lines.push("");
    lines.push(...quadrantLines(STATE_QUADRANTS, project.stateMapping));
    lines.push("");

    // Intended traits
    lines.push("## Intended traits (lasting, after the experience)");
    lines.push("");
    lines.push(...quadrantLines(TRAIT_QUADRANTS, project.traitMapping));
    lines.push("");
  }

  if (includeIntensityCurve) {
    // Intensity / engagement curve
    lines.push("## Intensity & engagement curve");
    lines.push("");
    lines.push(
      "Intensity is derived from the engagement mix: the more agency participants hold, the more attention the facilitator gives to pacing and consent.",
    );
    lines.push("");
    if (totalMinutes > 0) {
      lines.push(`**Total estimated runtime:** ${totalMinutes} min`);
      lines.push("");
    }
    lines.push("| # | Stage | Duration | Intensity | Engagement mix | Presence emphasis |");
    lines.push("|---|-------|----------|-----------|----------------|-------------------|");
    stages.forEach((st, i) => {
      const score = intensityScore(st.engagementDistribution);
      lines.push(
        `| ${i + 1} | ${st.name || `Stage ${i + 1}`} | ${
          st.estimatedMinutes != null ? `${st.estimatedMinutes} min` : "flex"
        } | \`${intensityBar(score)}\` | ${engagementMix(st.engagementDistribution)} | ${presenceEmphasis(st.presenceTypes)} |`,
      );
    });
    lines.push("");

    // Stage care notes (only stages that carry notes)
    const noted = stages.filter((st) => st.narrativeNotes?.trim() || st.designIntent?.trim());
    if (noted.length > 0) {
      lines.push("### Stage notes");
      lines.push("");
      noted.forEach((st) => {
        lines.push(`**${st.name}**`);
        if (st.narrativeNotes?.trim()) lines.push(`- Narrative: ${st.narrativeNotes.trim()}`);
        if (st.designIntent?.trim()) lines.push(`- Design intent: ${st.designIntent.trim()}`);
        lines.push("");
      });
    }
  }

  if (includePresenceProfile) {
    // Presence types (overall)
    lines.push("## Presence profile (overall)");
    lines.push("");
    PRESENCE_TYPES.forEach((p) => {
      lines.push(
        `- **${p.label}:** ${project.presenceTypes?.[p.code] ?? 0}/100. ${p.description}`,
      );
    });
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  if (includeConsentGroundingIntegration) {
    // Fixed best-practice sections
    lines.push("## Consent & opt-out");
    lines.push("");
    lines.push("- Brief every participant before the experience begins: what will happen, how long it lasts, what sensory and emotional territory it may enter.");
    lines.push("- Agree an explicit opt-out signal (verbal and non-verbal) before starting. Honour it immediately and without discussion.");
    lines.push("- Leaving is always allowed, at any point, no explanation required. Make the physical exit path known and keep it unobstructed.");
    lines.push("- If the experience involves touch or close proximity, obtain specific consent for it separately. General participation is not consent to touch.");
    lines.push("- Re-entry after stepping out is welcome but never pressured. Check in privately before a participant rejoins.");
    lines.push("- Note any contraindications shared during briefing (e.g. photosensitivity, cardiovascular conditions, recent crisis) and adapt or advise accordingly.");
    lines.push("");

    lines.push("## Grounding techniques");
    lines.push("");
    lines.push("- Keep a designated low-stimulation space available: dimmer light, lower volume, somewhere to sit, water within reach.");
    lines.push("- Orientation: invite the participant to name five things they can see, four they can hear, three they can touch. Speak slowly and concretely.");
    lines.push("- Breath pacing: longer exhale than inhale (e.g. in for 4, out for 6). Breathe with them rather than instructing at them.");
    lines.push("- Body anchoring: feet flat on the floor, hands pressing together or onto the thighs, feeling the weight of the body on the chair or ground.");
    lines.push("- Reduce input before adding reassurance: turn stimulation down first, then talk. Use the participant's name and normal, everyday language.");
    lines.push("- Stay with a destabilised participant until they are clearly settled; hand over explicitly to another team member if you must step away.");
    lines.push("");

    lines.push("## Integration prompts");
    lines.push("");
    lines.push("Offer these after the experience, in a closing circle, a quiet journaling moment, or a follow-up message within 72 hours:");
    lines.push("");
    lines.push("- What moment stays with you most vividly, and what was happening in your body then?");
    lines.push("- Did anything surprise you about how you responded?");
    lines.push("- Is there a feeling or insight from the experience you would like to keep? What would honouring it this week look like?");
    lines.push("- Was there anything unfinished or uncomfortable you would like to name?");
    lines.push("- Who in your life would you like to share this experience with?");
    lines.push("");
    lines.push("Keep integration invitational: prompts are offered, never required. Provide a contact route for participants who want to process something later.");
    lines.push("");
  }

  return lines.join("\n");
}
