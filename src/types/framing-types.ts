// Framing types — the hypercube methodology applied to different purposes.
//
// The backbone is constant: an Intention Core surrounded by six dimensions,
// mapping transient states → lasting traits, grounded in meaning. A framing
// type re-themes that backbone (labels, questions, vocabulary emphasis) for
// a specific practice WITHOUT changing the underlying schema — every type
// still writes to the same CXDProject fields and hypercube faces, so the
// canvas, Map view, tagging, and Plan tab work identically for all of them.
//
// Deliberately curated (not user-generic): each type is a meaningful practice
// the methodology genuinely serves. A fully custom "build your own hypercube"
// is a planned later milestone (requires dynamic faces/tags/wizard).

import type { CXDSectionId } from './cxd-schema';

export type FramingTypeId = 'experience' | 'ritual' | 'learning' | 'brand';

export interface FramingSectionTheme {
  /** Display label for this section under this framing type */
  label: string;
  /** The step's guiding question, in this type's vocabulary */
  question: string;
  /** One sentence explaining the step's purpose */
  intent: string;
  /** Sub-questions / prompts shown under the main question */
  subQuestions?: string[];
}

export interface FramingType {
  id: FramingTypeId;
  name: string;
  tagline: string;
  emoji: string;
  /** Who this is for — shown on the picker card */
  audience: string;
  /**
   * Per-section overrides. Sections without an override keep the default
   * (Experience Design) wording from WIZARD_STEPS / CXD_SECTIONS.
   */
  sectionThemes: Partial<Record<CXDSectionId, FramingSectionTheme>>;
}

// ─── The four curated types ──────────────────────────────────────────
// 'experience' is the identity default: zero overrides, canonical wording.

export const FRAMING_TYPES: FramingType[] = [
  {
    id: 'experience',
    name: 'Experience Design',
    tagline: 'Immersive, transformative experiences across realities',
    emoji: '🌀',
    audience: 'Experience designers, immersive artists, event creators',
    sectionThemes: {}, // canonical — uses the default wizard wording
  },
  {
    id: 'ritual',
    name: 'Ritual & Ceremony',
    tagline: 'Sacred containers, retreats, and rites of passage',
    emoji: '🕯️',
    audience: 'Facilitators, retreat leaders, ceremony designers',
    sectionThemes: {
      intentionCore: {
        label: 'Sacred Intention',
        question: 'What is this ceremony in service of?',
        intent: 'Name the ceremony and the transformation it holds space for.',
        subQuestions: [
          'What is the ceremony called?',
          'What is its central offering or medicine?',
          'What one message should participants carry home?',
        ],
      },
      desiredChange: {
        label: 'Intended Shift',
        question: 'What shift are participants crossing this threshold for?',
        intent: 'Articulate the inner change the ritual is designed to open.',
        subQuestions: [
          'What realizations may surface?',
          'What feelings should the container evoke and hold?',
          'What states of consciousness are invited?',
          'What understanding should participants integrate?',
        ],
      },
      humanContext: {
        label: 'The Circle',
        question: 'Who is arriving, and what do they carry?',
        intent: 'Understand participants, their needs, and their role in the ceremony.',
        subQuestions: [
          'What do participants need to feel safe and held?',
          'What are they longing for?',
          'Are they witnesses, participants, or co-celebrants?',
        ],
      },
      contextAndMeaning: {
        label: 'Symbolic Architecture',
        question: 'What symbolic world does the ceremony take place in?',
        intent: 'Define the setting, the mythic arc, and the ritual mechanism.',
        subQuestions: [
          'What sacred space or setting holds the ceremony?',
          'What story or mythos does it enact?',
          'What is the ritual act at its heart — the moment of magic?',
        ],
      },
      realityPlanes: {
        label: 'Planes of the Container',
        question: 'Through which realities does the ceremony move?',
        intent: 'Choose the mediums — physical space, breath and body, imagination, technology.',
      },
      stateMapping: {
        label: 'Ceremonial States',
        question: 'What states does the ceremony induce in the moment?',
        intent: 'Map the transient inner weather of the ritual.',
      },
      traitMapping: {
        label: 'Integration',
        question: 'What lasts after the circle closes?',
        intent: 'Name the enduring changes participants integrate into daily life.',
      },
    },
  },
  {
    id: 'learning',
    name: 'Learning Journey',
    tagline: 'Courses, workshops, and transformational education',
    emoji: '📖',
    audience: 'Educators, workshop leaders, course creators',
    sectionThemes: {
      intentionCore: {
        label: 'Learning Intention',
        question: 'What is this journey teaching, at its core?',
        intent: 'Name the course and the essential understanding it transmits.',
        subQuestions: [
          'What is the journey called?',
          'What is the core concept learners must grasp?',
          'What one idea should every learner leave with?',
        ],
      },
      desiredChange: {
        label: 'Learning Outcomes',
        question: 'What should learners be able to do, feel, and understand?',
        intent: 'Define insight, confidence, capability, and knowledge outcomes.',
        subQuestions: [
          'What insights should learners reach themselves?',
          'What feelings sustain their motivation?',
          'What states support deep learning — focus, flow, curiosity?',
          'What knowledge must be transmitted directly?',
        ],
      },
      humanContext: {
        label: 'The Learners',
        question: 'Who is learning, and where are they starting from?',
        intent: 'Understand prior knowledge, needs, and the learner’s role.',
        subQuestions: [
          'What do learners need to progress — scaffolding, safety, challenge?',
          'What do they want for themselves?',
          'Are they students, practitioners, or co-explorers?',
        ],
      },
      contextAndMeaning: {
        label: 'Knowledge Architecture',
        question: 'What world of meaning does the material live in?',
        intent: 'Frame the discipline, the narrative through-line, and the aha mechanism.',
        subQuestions: [
          'What field or world does the journey explore?',
          'What narrative arc carries learners through the material?',
          'What is the moment of insight — where understanding clicks?',
        ],
      },
      realityPlanes: {
        label: 'Learning Modalities',
        question: 'Through which mediums does the learning happen?',
        intent: 'Choose the delivery planes — in-person, digital, embodied, imaginal.',
      },
      stateMapping: {
        label: 'Learning States',
        question: 'What states should learners be in while learning?',
        intent: 'Map the cognitive, emotional, somatic, and social states of the journey.',
      },
      traitMapping: {
        label: 'Lasting Capabilities',
        question: 'What can they do a year later?',
        intent: 'Name the durable skills, habits, and perspective shifts.',
      },
    },
  },
  {
    id: 'brand',
    name: 'Brand & Product Experience',
    tagline: 'How a brand is felt across every touchpoint',
    emoji: '💎',
    audience: 'Brand strategists, product teams, agencies',
    sectionThemes: {
      intentionCore: {
        label: 'Brand Core',
        question: 'What does this brand stand for, at its center?',
        intent: 'Name the brand and the essential promise everything orbits.',
        subQuestions: [
          'What is the brand or product called?',
          'What is its central concept or positioning?',
          'What one message should every touchpoint whisper?',
        ],
      },
      desiredChange: {
        label: 'Desired Perception',
        question: 'How should people think and feel after encountering the brand?',
        intent: 'Define the perception shift the experience creates.',
        subQuestions: [
          'What realizations should customers have about the brand?',
          'What emotions should it evoke?',
          'What state should an encounter leave people in?',
          'What should customers know and remember?',
        ],
      },
      humanContext: {
        label: 'The Audience',
        question: 'Who is the brand for, and what do they care about?',
        intent: 'Understand audience needs, desires, and their relationship to the brand.',
        subQuestions: [
          'What do customers need from the category?',
          'What do they aspire to?',
          'Are they consumers, members, or advocates?',
        ],
      },
      contextAndMeaning: {
        label: 'Brand World',
        question: 'What world does the brand invite people into?',
        intent: 'Define the brand universe, its story, and its signature magic.',
        subQuestions: [
          'What world or aesthetic does the brand inhabit?',
          'What story does it tell across touchpoints?',
          'What is its signature moment — the thing only this brand does?',
        ],
      },
      realityPlanes: {
        label: 'Touchpoint Planes',
        question: 'Across which channels and realities does the brand live?',
        intent: 'Choose the touchpoints — physical, digital, social, ambient.',
      },
      stateMapping: {
        label: 'Encounter States',
        question: 'What does a brand encounter feel like in the moment?',
        intent: 'Map the immediate cognitive, emotional, and sensory impressions.',
      },
      traitMapping: {
        label: 'Brand Relationship',
        question: 'What lasting relationship does the brand build?',
        intent: 'Name the enduring loyalty, identity, and trust the brand earns.',
      },
    },
  },
];

export const DEFAULT_FRAMING_TYPE: FramingTypeId = 'experience';

export function getFramingType(id: string | undefined | null): FramingType {
  return FRAMING_TYPES.find((t) => t.id === id) ?? FRAMING_TYPES[0];
}

/**
 * Post-wizard start modes (chosen on the completion screen).
 * A freeform "AI draft" mode was tried and retired — it produced generic,
 * unusable layouts. Its successor is 'ai-template': the AI COMPOSER picks the
 * best starting template from the curated design-system catalog
 * (templates.ts) based on the framing summary — selection over generation.
 * 'populate' remains the satellite-graph generator in framing-to-canvas.ts.
 */
export type FramingStartMode = 'populate' | 'blank' | 'ai-template';
