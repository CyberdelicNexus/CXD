// Painted size of a task card, derived from FreeformCard's markup in
// canvas-element.tsx (Inter, Tailwind px values). A task card is not
// resizable: the element wrapper pins its width to 300px, gives it
// min-height 300px, and grows it with its content (height: auto). Engines
// must reserve at least this much, or the card paints over its neighbours.
//
//   card border (1px top + bottom)                          2
//   emoji row: text-lg leading-none (18) + py-[7px] (14)   32
//   content, p-3 flex-col gap-2:
//     padding top                                          12
//     title: text-xl font-bold, 28px per line            28n
//     description (when set): gap 8 + text-sm, 20/line  8+20n
//     gap 8 + subtasks block: mt-2 8 + border 1 + pt-2 8
//       + "Add subtask" row (text-xs, 16)                  41
//     padding bottom                                       12
//   properties panel, px-3 pt-1 pb-3 border-t space-y-2:
//     border 1 + pt 4 + pb 12                              17
//     Status (h-6 button) 24, Priority (py-0.5 text-xs) 20,
//     Start 24, Due 24 (DatePicker h-6), 4 gaps of 8      124
//     Assignee: h-7 icon button (28) and a wrapping row of
//     owner pills (22 tall, gap 6)                   28 or more
//
// One-line title, no description, one owner: 296px -> the 300px floor.
// One-line title and a one-line description: 324px.
// Text wrap is estimated with per-character widths that are at least
// Inter's advance widths (measured in Chromium), so estimates err tall.

export const TASK_CARD_W = 300;
export const TASK_CARD_MIN_H = 300;
/** Longest description a rendered task keeps; longer detail is cut with an ellipsis. */
export const TASK_DETAIL_MAX = 140;
/** Longest owner string a rendered task keeps. */
export const TASK_OWNER_MAX = 60;

/** Content box inside the card border and p-3 padding. */
const TEXT_W = TASK_CARD_W - 2 - 24;
/** Assignee pill row: panel content width, minus the 60px label and gap-2. */
const PILL_ROW_W = TEXT_W - 60 - 8;

const FIXED = 2 + 32 + 12 + 41 + 12 + 17 + 124;
const TITLE_LINE = 28;
const DESC_LINE = 20;
const DESC_GAP = 8;
const ASSIGNEE_BUTTON = 28;
const PILL_H = 22;
const PILL_GAP = 6;

/** Per-character advance in em, rounded up from Inter at 400 and 700. */
function charEm(c: string): number {
  if (c === " ") return 0.3;
  if ("ijlI.,:;'!|".includes(c)) return 0.35;
  if ("frt()[]{}/\\-`\"*^".includes(c)) return 0.55;
  if ("mwMW@%".includes(c)) return 1.05;
  if (/[a-z]/.test(c)) return 0.66;
  if (/[A-Z0-9#$&+<=>?_~]/.test(c)) return 0.82;
  return 1.1; // non-ASCII: accents, emoji, CJK
}

export function textWidth(s: string, px: number): number {
  let em = 0;
  for (const c of Array.from(s)) em += charEm(c);
  return em * px;
}

/**
 * Lines a pre-wrapped text block takes at `px` in a `width` box: newlines
 * break, words wrap greedily, and a word wider than the line breaks anywhere
 * (overflow-wrap: break-word).
 */
export function wrappedLines(text: string, px: number, width: number): number {
  let lines = 0;
  for (const para of text.split("\n")) {
    let n = 1;
    let x = 0;
    for (const word of para.split(" ")) {
      const w = textWidth(word, px);
      const space = x > 0 ? textWidth(" ", px) : 0;
      if (x > 0 && x + space + w > width) { n++; x = 0; }
      else x += space;
      if (w > width) {
        n += Math.ceil(w / width) - 1;
        x = w % width;
      } else x += w;
    }
    lines += n;
  }
  return Math.max(lines, 1);
}

/** Height of the Assignee row: the icon button, then one pill per comma-separated owner, wrapping. */
function assigneeRowHeight(owner: string): number {
  const names = owner.split(",").map((s) => s.trim()).filter(Boolean);
  let rowH = ASSIGNEE_BUTTON;
  let total = 0;
  let x = ASSIGNEE_BUTTON;
  for (const name of names) {
    const textW = PILL_ROW_W - 14;
    const lines = wrappedLines(name, 10, textW);
    const w = lines > 1 ? PILL_ROW_W : Math.ceil(textWidth(name, 10)) + 14;
    const h = 16 * lines + 6;
    if (x + PILL_GAP + w > PILL_ROW_W) {
      total += rowH + PILL_GAP;
      rowH = h;
      x = w;
    } else {
      x += PILL_GAP + w;
      rowH = Math.max(rowH, h);
    }
  }
  return total + rowH;
}

/** Painted height of a task card with this title, description and owner (before the 300px floor). */
export function taskCardContentHeight(title: string, description: string, owner: string): number {
  const t = title.trim() || "Untitled";
  const d = description.trim();
  return FIXED
    + TITLE_LINE * wrappedLines(t, 20, TEXT_W)
    + (d ? DESC_GAP + DESC_LINE * wrappedLines(d, 14, TEXT_W) : 0)
    + assigneeRowHeight(owner.trim());
}

/** Painted height of a task card, floor included. */
export function taskCardHeight(title: string, description: string, owner: string): number {
  return Math.max(TASK_CARD_MIN_H, taskCardContentHeight(title, description, owner));
}

/** A task's description as rendered: at most TASK_DETAIL_MAX characters. */
export function clampTaskDetail(detail: string): string {
  const chars = Array.from(detail.trim());
  return chars.length <= TASK_DETAIL_MAX ? chars.join("") : `${chars.slice(0, TASK_DETAIL_MAX - 1).join("").trimEnd()}…`;
}

/** A task's owner as rendered, or "" for none. */
export function taskOwner(props: Record<string, unknown>): string {
  const o = props.owner;
  return typeof o === "string" ? Array.from(o.trim()).slice(0, TASK_OWNER_MAX).join("") : "";
}
