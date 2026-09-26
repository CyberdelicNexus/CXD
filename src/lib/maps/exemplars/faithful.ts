// Faithfulness: an exemplar organises its input and never invents facts.
// Models copy exemplars closely, so an invented "18 guests" or a made-up URL
// in an example teaches them to fabricate. Two hard rules, checked for every
// exemplar in exemplars.verify and required of the lab's promote path:
//
// 1. URLs. Every URL anywhere in the graph (props.url included) appears
//    verbatim in the input: its title, text, or a card's title or body.
// 2. Numbers. Every number token in the graph's text appears in the input.
//    - A number token is a run of digits with optional "."/"," groups:
//      "4,200", "12.25", the "40" in "40%" or "€40", the "22" and "00" in "22:00".
//    - Tokens compare with "," removed, so "4,200" matches "4200".
//    - Graph text: the map title, node labels and details, string values in
//      props (table cells included) except decoration keys (emoji, icon,
//      shapeType, componentKey), relation labels and legend meanings. URLs
//      are cut out first; rule 1 covers them.
//    - Exceptions: a whole number from 1 to 10 in a table's header row (a
//      column ordinal such as "Option 2"), and a number inside a word that
//      also appears in the input ("Q3" when the input says "Q3").
// Numbers written as words ("twelve") are not checked: review them by hand.
import { parseProps } from "../layouts/shared";
import type { MapGraph } from "../types";
import type { ExemplarInput } from "./types";

export const URL_RE = /https?:\/\/[^\s"'<>()[\]{}]+/g;
const NUMBER_RE = /\d+(?:[.,]\d+)*/g;
// ASCII letters/digits, matching the rest of the library's word handling
// (similarity.ts's normaliseWords): good enough to spot "a number inside a word".
const WORD_CHAR = /[a-zA-Z0-9]/;
const WORD_RE = /[a-zA-Z0-9]+/g;
/** Props that decorate rather than state content. */
const DECORATION_KEYS = new Set(["emoji", "icon", "shapeType", "componentKey"]);
const MAX_HEADER_ORDINAL = 10;

type InputText = Pick<ExemplarInput, "title" | "text" | "cards">;

/** Everything the input says, as one string. */
export function inputSource(input: InputText): string {
  return [input.title, input.text, ...(input.cards ?? []).flatMap((c) => [c.title, c.body])].join("\n");
}

const normNumber = (s: string) => s.replace(/,/g, "");
const stripUrls = (s: string) => s.replace(URL_RE, " ");

/** Number tokens in a string, URLs cut out. */
export function numberTokens(s: string): string[] {
  return (stripUrls(s).match(NUMBER_RE) ?? []);
}

/** The whole letters-and-digits word around s[start, end). */
function wordAround(s: string, start: number, end: number): string {
  let a = start;
  let b = end;
  while (a > 0 && WORD_CHAR.test(s[a - 1])) a--;
  while (b < s.length && WORD_CHAR.test(s[b])) b++;
  return s.slice(a, b);
}

interface Snippet { where: string; text: string; headerRow?: boolean }

/** Every piece of text the graph states, with where it sits. */
function graphSnippets(g: MapGraph): Snippet[] {
  const out: Snippet[] = [{ where: "map title", text: g.title }];
  for (const n of g.nodes) {
    out.push({ where: `node ${n.id} label`, text: n.label });
    if (n.detail) out.push({ where: `node ${n.id} detail`, text: n.detail });
    const p = parseProps(n.props);
    for (const [key, value] of Object.entries(p)) {
      if (DECORATION_KEYS.has(key)) continue;
      if (key === "cells" && Array.isArray(value)) {
        value.forEach((row, r) => {
          if (!Array.isArray(row)) return;
          row.forEach((cell, c) => {
            if (typeof cell === "string" || typeof cell === "number") {
              out.push({ where: `node ${n.id} cell [${r}][${c}]`, text: String(cell), headerRow: r === 0 && p.headerRow === true });
            }
          });
        });
        continue;
      }
      const strings: string[] = [];
      const walk = (v: unknown) => {
        if (typeof v === "string") strings.push(v);
        else if (typeof v === "number") strings.push(String(v));
        else if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") Object.values(v).forEach(walk);
      };
      walk(value);
      strings.forEach((s) => out.push({ where: `node ${n.id} props.${key}`, text: s }));
    }
  }
  g.relations.forEach((r) => { if (r.label) out.push({ where: `relation ${r.from}->${r.to} label`, text: r.label }); });
  g.legend.forEach((l) => out.push({ where: `legend ${l.tint}`, text: l.meaning }));
  return out;
}

/** Every way the graph states something the input does not; empty means faithful. */
export function faithfulnessProblems(input: InputText, graph: MapGraph): string[] {
  const source = inputSource(input);
  const inputNumbers = new Set(numberTokens(source).map(normNumber));
  // Numbers inside URLs in the input still count as stated.
  (source.match(URL_RE) ?? []).forEach((u) => (u.match(NUMBER_RE) ?? []).forEach((x) => inputNumbers.add(normNumber(x))));
  const inputWords = new Set((source.toLowerCase().match(WORD_RE) ?? []));
  const problems: string[] = [];
  for (const s of graphSnippets(graph)) {
    for (const url of s.text.match(URL_RE) ?? []) {
      if (!source.includes(url)) problems.push(`${s.where}: URL ${url} is not in the input`);
    }
    const text = stripUrls(s.text);
    const re = new RegExp(NUMBER_RE.source, "g");
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(text))) {
      const token = m[0];
      if (inputNumbers.has(normNumber(token))) continue;
      const start = m.index;
      const word = wordAround(text, start, start + token.length);
      if (/[a-zA-Z]/.test(word) && inputWords.has(word.toLowerCase())) continue;
      if (s.headerRow && /^\d+$/.test(token) && Number(token) >= 1 && Number(token) <= MAX_HEADER_ORDINAL) continue;
      problems.push(`${s.where}: number ${token} is not in the input ("${s.text}")`);
    }
  }
  return problems;
}
