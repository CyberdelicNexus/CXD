// Canvas export: draws a board (or a selection of it) straight onto an HTML
// canvas from the element data, then encodes it as PNG / JPEG / PDF.
//
// Why not screenshot the DOM: the live canvas only mounts elements near the
// viewport (culling), edges render in separate overlay trees, and html2canvas
// can't do backdrop-filter, gradient text or SVG filters. Drawing from data
// gives a complete, crisp image of any size independent of pan, zoom and what
// is on screen, which is what makes it useful for handing a whole flow chart
// to an AI in one piece.
//
// Fidelity note: flow-chart content (shapes, text, cards, containers,
// connectors, lines, tables, images) is drawn faithfully; embedded web content
// (link embeds) is drawn as a card.

import type {
  CanvasElement,
  CanvasEdge,
  ContainerElement,
  FreeformElement,
  ImageElement,
  ShapeElement,
  TextElement,
  LineElement,
  TableElement,
  LinkElement,
  BoardElement,
  ExperienceBlockElement,
  LineEndStyle,
} from '@/types/canvas-elements';
import { getAnchorPosition, getClosestAnchors } from '@/types/canvas-elements';
import { GRADIENTS, getGradient, type GradientName } from '@/components/cxd/canvas/connector-gradients';
import { shapePath, shapeTextInsets } from '@/lib/shape-geometry';
import { DEFAULT_SHAPE_STYLE } from '@/lib/style-presets';

export type ExportFormat = 'png' | 'jpeg' | 'pdf';
export type ExportQuality = 'standard' | 'high' | 'ai';
export type ExportBackground = 'dark' | 'transparent';

export interface ExportOptions {
  format: ExportFormat;
  quality?: ExportQuality;
  background?: ExportBackground;
  /** World-px of padding around the content. */
  padding?: number;
  /** Override the longest output side in px (used for small previews). */
  maxDimensionOverride?: number;
}

export interface ExportScene {
  elements: CanvasElement[];
  edges: CanvasEdge[];
}

export interface ExportResult {
  blob: Blob;
  width: number; // output px
  height: number;
  mime: string;
  ext: string;
}

const QUALITY: Record<ExportQuality, { scale: number; maxDim: number }> = {
  standard: { scale: 2, maxDim: 8192 },
  high: { scale: 3, maxDim: 12000 },
  // Vision models downscale large images, so cap the long side: text stays
  // legible and the file small.
  ai: { scale: 2, maxDim: 2400 },
};
const MAX_PIXELS = 80_000_000;
const BG_DARK_INNER = '#1a0b2e';
const BG_DARK_OUTER = '#050308';
const DEFAULT_NOTE_BG = 'linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)';
const UI_FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

const TINTS: Record<string, { mid: string; light: string }> = {
  violet: { mid: '#7C3AED', light: '#C4B5FD' },
  ocean: { mid: '#2563EB', light: '#67E8F9' },
  emerald: { mid: '#059669', light: '#6EE7B7' },
  sunset: { mid: '#EA580C', light: '#FDE68A' },
  rose: { mid: '#DB2777', light: '#FBCFE8' },
  glacier: { mid: '#475569', light: '#E2E8F0' },
};

type Pt = { x: number; y: number };

// ───────────────────────── scene selection ─────────────────────────

function descendantsOf(rootId: string, all: CanvasElement[]): Set<string> {
  const out = new Set<string>();
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const el of all) {
      if (el.containerId === cur && !out.has(el.id)) {
        out.add(el.id);
        queue.push(el.id);
      }
    }
  }
  return out;
}

/**
 * Pick what to draw. With `selectedIds`, only those elements (plus everything
 * nested in selected containers); otherwise the whole board. Edges are kept
 * when both endpoints are included. Inbox items, legacy connector elements and
 * children of collapsed containers are never drawn.
 */
export function buildScene(
  all: CanvasElement[],
  allEdges: CanvasEdge[],
  selectedIds?: Set<string> | null,
): ExportScene {
  const hidden = new Set<string>();
  for (const el of all) {
    if (el.type === 'container' && (el as ContainerElement).collapsed) {
      descendantsOf(el.id, all).forEach((id) => hidden.add(id));
    }
  }
  let ids: Set<string> | null = null;
  if (selectedIds && selectedIds.size > 0) {
    ids = new Set(selectedIds);
    selectedIds.forEach((id) => {
      const el = all.find((e) => e.id === id);
      if (el?.type === 'container') descendantsOf(id, all).forEach((d) => ids!.add(d));
    });
  }
  const elements = all.filter(
    (el) => !el.inInbox && el.type !== 'connector' && !hidden.has(el.id) && (!ids || ids.has(el.id)),
  );
  const present = new Set(elements.map((e) => e.id));
  const edges = allEdges.filter((e) => present.has(e.fromNodeId) && present.has(e.toNodeId));
  return { elements, edges };
}

// ───────────────────────── geometry ─────────────────────────

function resolveEdgePoints(edge: CanvasEdge, from: CanvasElement, to: CanvasElement) {
  let fromAnchor = edge.fromAnchor;
  let toAnchor = edge.toAnchor;
  if (edge.fromAutoAnchor || edge.toAutoAnchor) {
    const closest = getClosestAnchors(from, to);
    if (edge.fromAutoAnchor) fromAnchor = closest.from;
    if (edge.toAutoAnchor) toAnchor = closest.to;
  }
  const fromRaw = getAnchorPosition(from, fromAnchor, edge.fromAutoAnchor ? 0.5 : edge.fromAnchorOffset);
  const toRaw = getAnchorPosition(to, toAnchor, edge.toAutoAnchor ? 0.5 : edge.toAnchorOffset);
  const OUT = 2;
  const out = (p: Pt, a: string): Pt =>
    a === 'top' ? { x: p.x, y: p.y - OUT } : a === 'bottom' ? { x: p.x, y: p.y + OUT } : a === 'left' ? { x: p.x - OUT, y: p.y } : { x: p.x + OUT, y: p.y };
  return { from: out(fromRaw, fromAnchor), to: out(toRaw, toAnchor), fromAnchor, toAnchor };
}

function rotatedBounds(el: CanvasElement) {
  const r = ((el.rotation || 0) * Math.PI) / 180;
  if (!r) return { minX: el.x, minY: el.y, maxX: el.x + el.width, maxY: el.y + el.height };
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const cos = Math.abs(Math.cos(r));
  const sin = Math.abs(Math.sin(r));
  const w = el.width * cos + el.height * sin;
  const h = el.width * sin + el.height * cos;
  return { minX: cx - w / 2, minY: cy - h / 2, maxX: cx + w / 2, maxY: cy + h / 2 };
}

export function sceneBounds(scene: ExportScene) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  };
  const byId = new Map(scene.elements.map((e) => [e.id, e]));
  for (const el of scene.elements) {
    if (el.type === 'line') {
      const l = el as LineElement;
      add(l.start.x, l.start.y); add(l.end.x, l.end.y);
      if (l.bend) add(l.bend.x, l.bend.y);
    } else {
      const b = rotatedBounds(el);
      add(b.minX, b.minY); add(b.maxX, b.maxY);
    }
  }
  for (const e of scene.edges) {
    const f = byId.get(e.fromNodeId), t = byId.get(e.toNodeId);
    if (!f || !t) continue;
    const { from, to } = resolveEdgePoints(e, f, t);
    add(from.x - 10, from.y - 10); add(from.x + 10, from.y + 10);
    add(to.x - 10, to.y - 10); add(to.x + 10, to.y + 10);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// ───────────────────────── colour / text helpers ─────────────────────────

const COLOR_RE = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|transparent)\s*(-?\d+(?:\.\d+)?%)?/g;

function makeGradient(ctx: CanvasRenderingContext2D, css: string, x: number, y: number, w: number, h: number): CanvasGradient | null {
  const m = css.match(/linear-gradient\(([\s\S]*)\)\s*$/i);
  if (!m) return null;
  const body = m[1];
  const ang = body.match(/(-?\d+(?:\.\d+)?)deg/);
  let deg = ang ? parseFloat(ang[1]) : 180;
  const toDir = body.match(/to\s+(top|bottom|left|right)(?:\s+(top|bottom|left|right))?/);
  if (toDir) {
    const d = [toDir[1], toDir[2]].filter(Boolean).join(' ');
    deg = { top: 0, right: 90, bottom: 180, left: 270, 'top right': 45, 'right top': 45, 'bottom right': 135, 'right bottom': 135, 'bottom left': 225, 'left bottom': 225, 'top left': 315, 'left top': 315 }[d] ?? 180;
  }
  const stops: Array<{ c: string; p: number | null }> = [];
  let s: RegExpExecArray | null;
  COLOR_RE.lastIndex = 0;
  const rest = body.replace(/^[^,]*?deg\s*,/, '').replace(/^to\s+[a-z ]+,/, '');
  while ((s = COLOR_RE.exec(rest))) stops.push({ c: s[1], p: s[2] ? parseFloat(s[2]) / 100 : null });
  if (stops.length === 0) return null;
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a), dy = -Math.cos(a);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = x + w / 2, cy = y + h / 2;
  const g = ctx.createLinearGradient(cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2);
  stops.forEach((st, i) => {
    const pos = st.p ?? (stops.length === 1 ? 0 : i / (stops.length - 1));
    try { g.addColorStop(Math.max(0, Math.min(1, pos)), st.c); } catch { /* bad colour: skip */ }
  });
  return g;
}

function paint(ctx: CanvasRenderingContext2D, css: string | undefined, x: number, y: number, w: number, h: number, fallback: string): string | CanvasGradient {
  if (!css || css === 'inherit') return fallback;
  if (css.includes('gradient')) return makeGradient(ctx, css, x, y, w, h) ?? fallback;
  if (css.includes('var(')) return fallback; // CSS variables don't exist on a canvas
  return css;
}

function fontWeightOf(w?: string): number {
  return w === 'bold' ? 700 : w === 'semibold' ? 600 : w === 'medium' ? 500 : w === '300' ? 300 : 400;
}

function fontFamilyOf(f?: string): string {
  return !f || f === 'inherit' ? UI_FONT : f;
}

function fontString(size: number, weight = 400, family = UI_FONT, italic = false): string {
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
}

/** Plain text from note HTML, keeping paragraph and list breaks. */
export function htmlToPlain(html: string): string {
  if (!html) return '';
  const marked = html
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|blockquote)\s*>/gi, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n');
  let text: string;
  if (typeof DOMParser !== 'undefined') {
    // DOMParser documents are inert: nothing loads or runs.
    text = new DOMParser().parseFromString(marked, 'text/html').body.textContent || '';
  } else {
    text = marked.replace(/<[^>]*>/g, '');
  }
  return text.replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (para === '') { out.push(''); continue; }
    if (!(maxWidth > 0)) { out.push(para); continue; }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (line && ctx.measureText(test).width > maxWidth) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = test;
      }
      // A single word wider than the box: break by characters.
      while (ctx.measureText(line).width > maxWidth && line.length > 1) {
        let i = line.length - 1;
        while (i > 1 && ctx.measureText(line.slice(0, i)).width > maxWidth) i--;
        out.push(line.slice(0, i));
        line = line.slice(i);
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

interface TextOpts {
  size: number;
  weight?: number;
  family?: string;
  italic?: boolean;
  underline?: boolean;
  color: string | CanvasGradient;
  align?: 'left' | 'center' | 'right';
  vAlign?: 'top' | 'middle';
  lineHeight?: number;
  wrap?: boolean;
  maxLines?: number;
}

/** Draws wrapped text in a box; returns the height used. Clips to the box. */
function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, o: TextOpts): number {
  if (!text) return 0;
  ctx.save();
  ctx.font = fontString(o.size, o.weight ?? 400, o.family ?? UI_FONT, o.italic);
  ctx.textBaseline = 'top';
  ctx.fillStyle = o.color;
  ctx.strokeStyle = typeof o.color === 'string' ? o.color : '#fff';
  const lh = o.size * (o.lineHeight ?? 1.3);
  let lines = o.wrap === false ? text.split('\n') : wrapLines(ctx, text, w);
  if (o.maxLines && lines.length > o.maxLines) {
    lines = lines.slice(0, o.maxLines);
    lines[o.maxLines - 1] = lines[o.maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  const total = lines.length * lh;
  let ty = o.vAlign === 'middle' ? y + Math.max(0, (h - total) / 2) : y;
  ctx.beginPath();
  ctx.rect(x - 2, y - 2, w + 4, h + 4);
  ctx.clip();
  for (const line of lines) {
    const lw = ctx.measureText(line).width;
    const tx = o.align === 'center' ? x + (w - lw) / 2 : o.align === 'right' ? x + w - lw : x;
    ctx.fillText(line, tx, ty);
    if (o.underline && line) {
      ctx.lineWidth = Math.max(1, o.size / 14);
      ctx.beginPath();
      ctx.moveTo(tx, ty + o.size * 1.08);
      ctx.lineTo(tx + lw, ty + o.size * 1.08);
      ctx.stroke();
    }
    ty += lh;
  }
  ctx.restore();
  return total;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${a})`;
}

// ───────────────────────── images ─────────────────────────

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  let p = imageCache.get(src);
  if (p) return p;
  const tryLoad = (url: string, cors: boolean) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      if (cors) img.crossOrigin = 'anonymous';
      const t = window.setTimeout(() => resolve(null), 10000);
      img.onload = () => { window.clearTimeout(t); resolve(img); };
      img.onerror = () => { window.clearTimeout(t); resolve(null); };
      img.src = url;
    });
  p = (async () => {
    if (src.startsWith('data:') || src.startsWith('blob:')) return tryLoad(src, false);
    // CORS-enabled load first: keeps the canvas exportable.
    const direct = await tryLoad(src, true);
    if (direct) return direct;
    try {
      const res = await fetch(src, { mode: 'cors' });
      if (!res.ok) return null;
      return await tryLoad(URL.createObjectURL(await res.blob()), false);
    } catch {
      return null; // not CORS-readable: drawn as a placeholder
    }
  })();
  imageCache.set(src, p);
  return p;
}

// ───────────────────────── element painters ─────────────────────────

type Images = Map<string, HTMLImageElement | null>;

function drawContainer(ctx: CanvasRenderingContext2D, el: ContainerElement) {
  const tint = TINTS[el.tintColor ?? 'violet'] ?? TINTS.violet;
  const h = el.collapsed ? 28 : el.height;
  roundRectPath(ctx, el.x, el.y, el.width, h, 14);
  ctx.fillStyle = hexToRgba(tint.mid, 0.1);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = hexToRgba(tint.mid, 0.5);
  ctx.stroke();
  if (!el.hideLabel && el.label) {
    drawText(ctx, el.label, el.x + 14, el.y + 9, el.width - 28, 20, {
      size: 13, weight: 600, color: tint.light, wrap: false,
    });
  }
}

function drawTextElement(ctx: CanvasRenderingContext2D, el: TextElement) {
  const size = el.style?.fontSize || 16;
  const pad = 4;
  const gradient = el.style?.bgColor?.startsWith('linear-gradient') ? el.style.bgColor : undefined;
  const color = gradient
    ? paint(ctx, gradient, el.x, el.y, el.width, el.height, '#fff')
    : paint(ctx, el.style?.textColor, el.x, el.y, el.width, el.height, '#ffffff');
  drawText(ctx, el.content || '', el.x + pad, el.y + pad, el.width - pad * 2, el.height - pad * 2, {
    size,
    weight: fontWeightOf(el.style?.fontWeight),
    family: fontFamilyOf(el.style?.fontFamily),
    italic: el.style?.fontStyle === 'italic',
    underline: el.style?.textDecoration === 'underline',
    color,
    align: el.textAlign || 'left',
    lineHeight: 1.3,
    wrap: !el.autoWidth,
  });
}

function drawShape(ctx: CanvasRenderingContext2D, el: ShapeElement) {
  const st = el.style || {};
  const bg = st.bgColor || DEFAULT_SHAPE_STYLE.bgColor!;
  const border = st.borderColor || DEFAULT_SHAPE_STYLE.borderColor!;
  const bw = st.borderWidth ?? DEFAULT_SHAPE_STYLE.borderWidth!;
  const opacity = (st.fillOpacity !== undefined ? st.fillOpacity : st.bgColor ? 100 : DEFAULT_SHAPE_STYLE.fillOpacity!) / 100;
  const { d, detail } = shapePath(el.shapeType, el.width, el.height, Math.max(1, bw / 2));
  ctx.save();
  ctx.translate(el.x, el.y);
  const path = new Path2D(d);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = paint(ctx, bg, 0, 0, el.width, el.height, 'rgba(124,58,237,0.3)');
  if (bg !== 'transparent') ctx.fill(path);
  ctx.globalAlpha = 1;
  if (bw > 0 && border !== 'transparent') {
    ctx.lineWidth = bw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = paint(ctx, border, 0, 0, el.width, el.height, '#a78bfa');
    if (st.borderStyle === 'dashed') ctx.setLineDash([bw * 3, bw * 2]);
    if (st.borderStyle === 'dotted') ctx.setLineDash([bw, bw * 2]);
    ctx.stroke(path);
    if (detail) { ctx.setLineDash([]); ctx.stroke(new Path2D(detail)); }
  }
  ctx.restore();
  const text = el.content || htmlToPlain(el.richContent || '');
  if (text) {
    const [t, r, b, l] = shapeTextInsets(el.shapeType);
    const tx = el.x + el.width * l, ty = el.y + el.height * t;
    const tw = el.width * (1 - l - r), th = el.height * (1 - t - b);
    const tc = st.textColor || DEFAULT_SHAPE_STYLE.textColor!;
    drawText(ctx, text, tx, ty, tw, th, {
      size: st.fontSize || 14,
      weight: fontWeightOf(st.fontWeight),
      family: fontFamilyOf(st.fontFamily),
      italic: st.fontStyle === 'italic',
      underline: st.textDecoration === 'underline',
      color: paint(ctx, tc, tx, ty, tw, th, '#ffffff'),
      align: st.textAlign || 'center',
      vAlign: 'middle',
      lineHeight: 1.3,
    });
  }
}

function drawFreeform(ctx: CanvasRenderingContext2D, el: FreeformElement) {
  const st = el.style || {};
  const textColor = st.textColor || '#ffffff';
  if (el.isDocument) {
    ctx.font = `36px ${UI_FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(el.emoji || '📄', el.x + el.width / 2, el.y + 2);
    ctx.textAlign = 'left';
    drawText(ctx, el.noteTitle || 'Untitled Document', el.x + 2, el.y + 46, el.width - 4, el.height - 46, {
      size: 10, weight: 600, color: '#fff', align: 'center', lineHeight: 1.4,
    });
    return;
  }
  roundRectPath(ctx, el.x, el.y, el.width, el.height, 8);
  ctx.fillStyle = paint(ctx, st.bgColor || DEFAULT_NOTE_BG, el.x, el.y, el.width, el.height, '#2A0A3D');
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.stroke();
  ctx.save();
  roundRectPath(ctx, el.x, el.y, el.width, el.height, 8);
  ctx.clip();
  const pad = 12;
  let y = el.y + pad;
  const iw = el.width - pad * 2;

  if (el.cardType === 'task') {
    const meta = el.taskMetadata;
    const raw = (el.content || '').split('\n');
    const title = (raw[0] || '').replace(/^-\s*\[[ xX]\]\s*/, '') || 'Task';
    const done = meta?.status === 'completed';
    y += drawText(ctx, (done ? '✓ ' : '') + title, el.x + pad, y, iw, 60, { size: 15, weight: 600, color: textColor, maxLines: 3 }) + 4;
    const desc = meta?.description || raw.slice(1).join('\n').trim();
    if (desc) y += drawText(ctx, desc, el.x + pad, y, iw, 70, { size: 12, color: 'rgba(255,255,255,0.7)', maxLines: 4 }) + 4;
    (meta?.subtasks || []).slice(0, 12).forEach((sub) => {
      if (y > el.y + el.height - 14) return;
      y += drawText(ctx, `${sub.isCompleted ? '☑' : '☐'} ${sub.text}`, el.x + pad, y, iw, 30, { size: 12, color: 'rgba(255,255,255,0.85)', maxLines: 2 }) + 2;
    });
    const tags = [meta?.status?.replace('_', ' '), meta?.priority, meta?.assignee].filter(Boolean).join(' · ');
    if (tags) drawText(ctx, tags, el.x + pad, el.y + el.height - 22, iw, 14, { size: 11, color: 'rgba(255,255,255,0.55)', wrap: false });
  } else {
    if (el.emoji) {
      ctx.font = `20px ${UI_FONT}`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(el.emoji, el.x + el.width / 2, y - 2);
      ctx.textAlign = 'left';
      y += 28;
    }
    if (!el.hideNoteTitle && el.noteTitle) {
      y += drawText(ctx, el.noteTitle, el.x + pad, y, iw, 50, { size: 16, weight: 700, color: textColor, maxLines: 2 }) + 6;
    }
    const body = htmlToPlain(el.noteBody || '') || (el.noteBody === undefined ? el.content : '');
    if (body) drawText(ctx, body, el.x + pad, y, iw, el.y + el.height - y - 8, { size: 13, color: textColor, lineHeight: 1.45 });
  }
  ctx.restore();
}

function drawImageEl(ctx: CanvasRenderingContext2D, el: ImageElement, imgs: Images) {
  const img = imgs.get(el.src) ?? null;
  const sb = !!el.storyboard;
  let ix = el.x, iy = el.y, iw = el.width, ih = el.height;
  if (sb) {
    roundRectPath(ctx, el.x, el.y, el.width, el.height, 10);
    ctx.fillStyle = el.storyboardBgColor || 'rgba(20,16,31,0.95)';
    ctx.fill();
    ctx.lineWidth = el.storyboardBorderWidth ?? 1;
    ctx.strokeStyle = el.storyboardBorderColor || 'rgba(255,255,255,0.2)';
    ctx.stroke();
    const cap = Math.max(0.08, Math.min(0.6, el.storyboardCaptionRatio ?? 0.22));
    ih = el.height * (1 - cap);
  }
  ctx.save();
  roundRectPath(ctx, ix, iy, iw, ih, sb ? 10 : 6);
  ctx.clip();
  if (img) {
    const crop = el.imageEdits?.crop;
    const sx = crop ? (crop.x / 100) * img.naturalWidth : 0;
    const sy = crop ? (crop.y / 100) * img.naturalHeight : 0;
    const sw = crop ? (crop.width / 100) * img.naturalWidth : img.naturalWidth;
    const sh = crop ? (crop.height / 100) * img.naturalHeight : img.naturalHeight;
    const fit = el.objectFit || 'cover';
    let dx = ix, dy = iy, dw = iw, dh = ih;
    let ssx = sx, ssy = sy, ssw = sw, ssh = sh;
    if (fit === 'contain') {
      const k = Math.min(iw / sw, ih / sh);
      dw = sw * k; dh = sh * k; dx = ix + (iw - dw) / 2; dy = iy + (ih - dh) / 2;
    } else if (fit === 'cover') {
      const k = Math.max(iw / sw, ih / sh);
      ssw = iw / k; ssh = ih / k;
      const pos = el.storyboardObjectPosition || { x: 50, y: 50 };
      ssx = sx + (sw - ssw) * (pos.x / 100);
      ssy = sy + (sh - ssh) * (pos.y / 100);
    }
    ctx.translate(ix + iw / 2, iy + ih / 2);
    ctx.scale(el.imageEdits?.flipH ? -1 : 1, el.imageEdits?.flipV ? -1 : 1);
    ctx.translate(-(ix + iw / 2), -(iy + ih / 2));
    ctx.drawImage(img, ssx, ssy, ssw, ssh, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(ix, iy, iw, ih);
    drawText(ctx, el.src ? '[image unavailable]' : '[empty image]', ix, iy, iw, ih, { size: 12, color: 'rgba(255,255,255,0.45)', align: 'center', vAlign: 'middle' });
  }
  ctx.restore();
  if (sb && el.description) {
    const cap = Math.max(0.08, Math.min(0.6, el.storyboardCaptionRatio ?? 0.22));
    const cy = el.y + el.height * (1 - cap);
    drawText(ctx, el.description, el.x + 10, cy + 6, el.width - 20, el.height * cap - 10, {
      size: 12, color: el.storyboardTextColor || '#fff', lineHeight: 1.35,
    });
  }
}

function drawLink(ctx: CanvasRenderingContext2D, el: LinkElement) {
  roundRectPath(ctx, el.x, el.y, el.width, el.height, 10);
  ctx.fillStyle = 'rgba(20,16,31,0.96)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(167,139,250,0.35)';
  ctx.stroke();
  const pad = 12;
  let y = el.y + pad;
  const title = el.title || el.fileName || el.domain || el.url || 'Link';
  y += drawText(ctx, '🔗 ' + title, el.x + pad, y, el.width - pad * 2, 40, { size: 14, weight: 600, color: '#fff', maxLines: 2 }) + 4;
  if (el.description) y += drawText(ctx, el.description, el.x + pad, y, el.width - pad * 2, 40, { size: 12, color: 'rgba(255,255,255,0.65)', maxLines: 2 }) + 4;
  if (el.url) drawText(ctx, el.url, el.x + pad, Math.min(y, el.y + el.height - 20), el.width - pad * 2, 16, { size: 11, color: '#a78bfa', wrap: false });
}

function drawBoard(ctx: CanvasRenderingContext2D, el: BoardElement) {
  const S = 128;
  const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
  const pts: Pt[] = [[50, 5], [93.3, 25], [93.3, 75], [50, 95], [6.7, 75], [6.7, 25]].map(([px, py]) => ({ x: cx - S / 2 + (px / 100) * S, y: cy - S / 2 + (py / 100) * S }));
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = paint(ctx, el.hexColor, cx - S / 2, cy - S / 2, S, S, 'rgba(76,29,149,0.55)');
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(196,181,253,0.7)';
  ctx.stroke();
  ctx.font = `34px ${UI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(el.icon && el.icon.length <= 4 ? el.icon : '▦', cx, cy - 6);
  ctx.textAlign = 'left';
  drawText(ctx, el.title || 'Board', cx - 60, cy + 22, 120, 34, { size: 12, weight: 600, color: '#fff', align: 'center', maxLines: 2 });
}

function drawExperienceBlock(ctx: CanvasRenderingContext2D, el: ExperienceBlockElement) {
  roundRectPath(ctx, el.x, el.y, el.width, el.height, 12);
  ctx.fillStyle = paint(ctx, el.style?.bgColor, el.x, el.y, el.width, el.height, '#3b1466');
  if (!el.style?.bgColor) {
    const g = ctx.createLinearGradient(el.x, el.y, el.x + el.width, el.y + el.height);
    g.addColorStop(0, '#2A0A3D'); g.addColorStop(1, '#0B2C5A');
    ctx.fillStyle = g;
  }
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(192,132,252,0.4)';
  ctx.stroke();
  drawText(ctx, el.title || el.componentKey, el.x + 12, el.y + 8, el.width - 24, el.height - 16, {
    size: 15, weight: 700, color: '#fff', align: 'center', vAlign: 'middle', maxLines: 3,
  });
}

function drawTable(ctx: CanvasRenderingContext2D, el: TableElement) {
  const rows = el.rows || el.cells?.length || 0;
  const cols = el.cols || el.cells?.[0]?.length || 0;
  if (!rows || !cols) return;
  const norm = (arr: number[] | undefined, n: number, total: number) => {
    const a = arr && arr.length === n ? arr : Array(n).fill(1);
    const sum = a.reduce((s, v) => s + v, 0) || 1;
    return a.map((v) => (v / sum) * total);
  };
  const cw = norm(el.colWidths, cols, el.width);
  const rh = norm(el.rowHeights, rows, el.height);
  ctx.save();
  roundRectPath(ctx, el.x, el.y, el.width, el.height, 8);
  ctx.clip();
  ctx.fillStyle = el.tableBg && !el.tableBg.includes('gradient') ? el.tableBg : 'rgba(20,16,31,0.95)';
  ctx.fillRect(el.x, el.y, el.width, el.height);
  let y = el.y;
  for (let r = 0; r < rows; r++) {
    let x = el.x;
    for (let c = 0; c < cols; c++) {
      const cell = el.cells?.[r]?.[c];
      const bg = cell?.bg || el.rowColors?.[r] || el.colColors?.[c];
      if (bg) { ctx.fillStyle = paint(ctx, bg, x, y, cw[c], rh[r], 'transparent'); ctx.fillRect(x, y, cw[c], rh[r]); }
      if (cell?.text) {
        const size = cell.fontSize === 'sm' ? 12 : cell.fontSize === 'lg' ? 18 : 14;
        drawText(ctx, cell.text, x + 8, y + 6, cw[c] - 16, rh[r] - 10, {
          size, weight: cell.bold ? 700 : 400, italic: cell.italic, color: cell.color || '#fff', align: cell.align || 'left',
        });
      }
      x += cw[c];
    }
    y += rh[r];
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  let gx = el.x;
  for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(gx, el.y); ctx.lineTo(gx, el.y + el.height); ctx.stroke(); gx += cw[c] ?? 0; }
  let gy = el.y;
  for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(el.x, gy); ctx.lineTo(el.x + el.width, gy); ctx.stroke(); gy += rh[r] ?? 0; }
  ctx.restore();
}

// ───────────────────────── lines and connectors ─────────────────────────

function drawCap(ctx: CanvasRenderingContext2D, kind: LineEndStyle | undefined, at: Pt, toward: Pt, width: number, color: string) {
  if (!kind || kind === 'none') return;
  const ang = Math.atan2(at.y - toward.y, at.x - toward.x);
  const s = 4 + width * 1.6;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  if (kind === 'arrow') { ctx.moveTo(0, 0); ctx.lineTo(-s * 1.4, -s * 0.7); ctx.lineTo(-s * 1.4, s * 0.7); }
  else if (kind === 'dot') ctx.arc(-s * 0.4, 0, s * 0.5, 0, Math.PI * 2);
  else if (kind === 'square') ctx.rect(-s, -s / 2, s, s);
  else { ctx.moveTo(0, 0); ctx.lineTo(-s / 2, -s / 2); ctx.lineTo(-s, 0); ctx.lineTo(-s / 2, s / 2); }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function dashFor(kind: string | undefined, w: number): number[] {
  return kind === 'dashed' ? [8, 5] : kind === 'dotted' ? [Math.max(1, w * 0.5), w * 2 + 2] : [];
}

function drawLineEl(ctx: CanvasRenderingContext2D, el: LineElement) {
  const st = el.style || {};
  const w = st.widthPx ?? 2;
  const bend = el.bend ?? { x: (el.start.x + el.end.x) / 2, y: (el.start.y + el.end.y) / 2 };
  let stroke: string | CanvasGradient = st.color || '#c4b5fd';
  let capColor = typeof stroke === 'string' ? stroke : '#c4b5fd';
  if (st.gradientName) {
    const g = GRADIENTS[st.gradientName as GradientName] ?? GRADIENTS.violet;
    const grad = ctx.createLinearGradient(el.start.x, el.start.y, el.end.x, el.end.y);
    grad.addColorStop(0, g.dark); grad.addColorStop(0.5, g.mid); grad.addColorStop(1, g.light);
    stroke = grad;
    capColor = g.light;
  }
  ctx.save();
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.setLineDash(dashFor(st.kind, w));
  ctx.beginPath();
  ctx.moveTo(el.start.x, el.start.y);
  ctx.quadraticCurveTo(bend.x, bend.y, el.end.x, el.end.y);
  ctx.stroke();
  ctx.setLineDash([]);
  drawCap(ctx, st.startCap, el.start, bend, w, capColor);
  drawCap(ctx, st.endCap, el.end, bend, w, capColor);
  ctx.restore();
}

function drawEdge(ctx: CanvasRenderingContext2D, edge: CanvasEdge, from: CanvasElement, to: CanvasElement) {
  const pts = resolveEdgePoints(edge, from, to);
  const a = pts.from, b = pts.to;
  const grad = getGradient(edge.style?.gradientName as GradientName | undefined);
  const t = edge.style?.thickness ?? 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const off = Math.max(60, Math.min(Math.abs(dx), Math.abs(dy)) * 0.4);
  const dir = (an: string, o: number): Pt =>
    an === 'right' ? { x: o, y: 0 } : an === 'left' ? { x: -o, y: 0 } : an === 'bottom' ? { x: 0, y: o } : { x: 0, y: -o };
  const fc = dir(pts.fromAnchor, off), tc = dir(pts.toAnchor, off);
  const c1 = { x: a.x + fc.x, y: a.y + fc.y }, c2 = { x: b.x + tc.x, y: b.y + tc.y };
  const straight = Math.abs(dy) < 20 || Math.abs(dx) < 20;

  const reversed = !!edge.style?.gradientReversed;
  const g = ctx.createLinearGradient(reversed ? b.x : a.x, reversed ? b.y : a.y, reversed ? a.x : b.x, reversed ? a.y : b.y);
  g.addColorStop(0, grad.dark); g.addColorStop(0.5, grad.mid); g.addColorStop(1, grad.light);

  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    if (straight) ctx.lineTo(b.x, b.y);
    else ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // soft glow under the stroke, like the on-screen connector
  trace();
  ctx.strokeStyle = g; ctx.globalAlpha = 0.18; ctx.lineWidth = t * 3; ctx.stroke();
  ctx.globalAlpha = 1;
  trace();
  ctx.strokeStyle = g; ctx.lineWidth = t;
  ctx.setLineDash(edge.style?.lineStyle === 'dashed' ? [8, 4] : edge.style?.lineStyle === 'dotted' ? [2, 4] : []);
  ctx.stroke();
  ctx.setLineDash([]);

  // end orbs
  const orb = (p: Pt, color: string) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(color, 0.35); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = hexToRgba(color, 0.7); ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  };
  orb(a, grad.mid);
  orb(b, grad.light);

  // arrowheads (same proportions as the canvas)
  const aTip = 4 + t * 0.85, aBack = 1.5 + t * 0.4, aHalf = 2 + t * 0.6;
  const arrow = (p: Pt, anchor: string, color: string) => {
    const outward = anchor === 'left' ? [-1, 0] : anchor === 'right' ? [1, 0] : anchor === 'top' ? [0, -1] : [0, 1];
    // the arrow points INTO the element: against the outward normal
    const ux = -outward[0], uy = -outward[1];
    ctx.beginPath();
    ctx.moveTo(p.x + ux * aTip, p.y + uy * aTip);
    ctx.lineTo(p.x - ux * aBack - uy * aHalf, p.y - uy * aBack + ux * aHalf);
    ctx.lineTo(p.x - ux * aBack + uy * aHalf, p.y - uy * aBack - ux * aHalf);
    ctx.closePath();
    ctx.fillStyle = color; ctx.globalAlpha = 0.95; ctx.fill(); ctx.globalAlpha = 1;
  };
  const as = edge.style?.arrowStyle;
  if (as === 'start' || as === 'both') arrow(a, pts.fromAnchor, grad.mid);
  if (as === 'end' || as === 'both') arrow(b, pts.toAnchor, grad.light);

  if (edge.label?.text) {
    const tt = edge.label.position ?? 0.5;
    const lx = straight ? a.x + dx * tt : Math.pow(1 - tt, 3) * a.x + 3 * Math.pow(1 - tt, 2) * tt * c1.x + 3 * (1 - tt) * tt * tt * c2.x + Math.pow(tt, 3) * b.x;
    const ly = straight ? a.y + dy * tt : Math.pow(1 - tt, 3) * a.y + 3 * Math.pow(1 - tt, 2) * tt * c1.y + 3 * (1 - tt) * tt * tt * c2.y + Math.pow(tt, 3) * b.y;
    const size = edge.label.fontSize || 12;
    ctx.font = fontString(size, 400, fontFamilyOf(edge.label.fontFamily));
    const tw = ctx.measureText(edge.label.text).width;
    roundRectPath(ctx, lx - tw / 2 - 8, ly - size * 0.85, tw + 16, size * 1.7, 5);
    ctx.fillStyle = 'rgba(14,10,24,0.92)'; ctx.fill();
    ctx.fillStyle = edge.label.color || '#e5e7eb';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(edge.label.text, lx, ly);
  }
  ctx.restore();
}

// ───────────────────────── render + encode ─────────────────────────

function collectFonts(scene: ExportScene): Set<string> {
  const fonts = new Set<string>([fontString(14, 400), fontString(14, 700), fontString(14, 600)]);
  for (const el of scene.elements) {
    const st = (el as { style?: { fontFamily?: string; fontWeight?: string; fontSize?: number } }).style;
    if (st?.fontFamily && st.fontFamily !== 'inherit') fonts.add(fontString(st.fontSize || 14, fontWeightOf(st.fontWeight), st.fontFamily));
  }
  return fonts;
}

async function preload(scene: ExportScene): Promise<Images> {
  const imgs: Images = new Map();
  const srcs = new Set<string>();
  scene.elements.forEach((el) => { if (el.type === 'image' && (el as ImageElement).src) srcs.add((el as ImageElement).src); });
  await Promise.all([
    ...Array.from(srcs).map(async (s) => { imgs.set(s, await loadImage(s)); }),
    ...Array.from(collectFonts(scene)).map((f) => document.fonts?.load(f, 'Aa😀').catch(() => undefined)),
  ]);
  try { await document.fonts?.ready; } catch { /* ignore */ }
  return imgs;
}

export function plannedSize(scene: ExportScene, opts: Pick<ExportOptions, 'quality' | 'padding' | 'maxDimensionOverride'>) {
  const b = sceneBounds(scene);
  if (!b) return null;
  const pad = opts.padding ?? 48;
  const worldW = b.width + pad * 2, worldH = b.height + pad * 2;
  const q = QUALITY[opts.quality ?? 'standard'];
  const maxDim = opts.maxDimensionOverride ?? q.maxDim;
  const scale = Math.min(
    opts.maxDimensionOverride ? Infinity : q.scale,
    maxDim / Math.max(worldW, worldH),
    Math.sqrt(MAX_PIXELS / (worldW * worldH)),
  );
  return { bounds: b, pad, worldW, worldH, scale, width: Math.max(1, Math.round(worldW * scale)), height: Math.max(1, Math.round(worldH * scale)) };
}

export async function renderSceneToCanvas(scene: ExportScene, opts: Pick<ExportOptions, 'quality' | 'padding' | 'background' | 'maxDimensionOverride'>): Promise<HTMLCanvasElement> {
  const plan = plannedSize(scene, opts);
  if (!plan) throw new Error('Nothing to export');
  const imgs = await preload(scene);
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser');

  if ((opts.background ?? 'dark') === 'dark') {
    const g = ctx.createRadialGradient(plan.width / 2, plan.height / 2, 0, plan.width / 2, plan.height / 2, Math.hypot(plan.width, plan.height) / 2);
    g.addColorStop(0, BG_DARK_INNER);
    g.addColorStop(1, BG_DARK_OUTER);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, plan.width, plan.height);
  }

  ctx.scale(plan.scale, plan.scale);
  ctx.translate(plan.pad - plan.bounds.minX, plan.pad - plan.bounds.minY);

  const byId = new Map(scene.elements.map((e) => [e.id, e]));
  const sorted = [...scene.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  // Containers sit under everything; lines under cards; connectors on top.
  const layers: CanvasElement[][] = [
    sorted.filter((e) => e.type === 'container'),
    sorted.filter((e) => e.type === 'line'),
    sorted.filter((e) => e.type !== 'container' && e.type !== 'line'),
  ];
  for (const layer of layers) {
    for (const el of layer) {
      ctx.save();
      if (el.rotation && el.type !== 'line') {
        ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
        ctx.rotate((el.rotation * Math.PI) / 180);
        ctx.translate(-(el.x + el.width / 2), -(el.y + el.height / 2));
      }
      try {
        switch (el.type) {
          case 'container': drawContainer(ctx, el as ContainerElement); break;
          case 'text': drawTextElement(ctx, el as TextElement); break;
          case 'shape': drawShape(ctx, el as ShapeElement); break;
          case 'freeform': drawFreeform(ctx, el as FreeformElement); break;
          case 'image': drawImageEl(ctx, el as ImageElement, imgs); break;
          case 'link': drawLink(ctx, el as LinkElement); break;
          case 'board': drawBoard(ctx, el as BoardElement); break;
          case 'experienceBlock': drawExperienceBlock(ctx, el as ExperienceBlockElement); break;
          case 'table': drawTable(ctx, el as TableElement); break;
          case 'line': drawLineEl(ctx, el as LineElement); break;
          default: break;
        }
      } catch (err) {
        // One bad element must not sink the whole export.
        console.warn('[canvas-export] could not draw element', el.id, el.type, err);
      }
      ctx.restore();
    }
  }
  for (const edge of scene.edges) {
    const f = byId.get(edge.fromNodeId), t = byId.get(edge.toNodeId);
    if (f && t) {
      try { drawEdge(ctx, edge, f, t); } catch (err) { console.warn('[canvas-export] could not draw edge', edge.id, err); }
    }
  }
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image is too large for this browser to encode. Try the "Fit for AI" quality.'))), mime, quality);
  });
}

export async function exportScene(scene: ExportScene, opts: ExportOptions): Promise<ExportResult> {
  // JPEG and PDF have no alpha: always paint the background for them.
  const background = opts.format === 'png' ? opts.background ?? 'dark' : 'dark';
  const canvas = await renderSceneToCanvas(scene, { ...opts, background });
  if (opts.format === 'png') {
    return { blob: await canvasToBlob(canvas, 'image/png'), width: canvas.width, height: canvas.height, mime: 'image/png', ext: 'png' };
  }
  if (opts.format === 'jpeg') {
    return { blob: await canvasToBlob(canvas, 'image/jpeg', 0.93), width: canvas.width, height: canvas.height, mime: 'image/jpeg', ext: 'jpg' };
  }
  // PDF: a single page the size of the board, so a long flow chart is ONE page
  // instead of being sliced across several.
  const plan = plannedSize(scene, opts)!;
  const { jsPDF } = await import('jspdf');
  const pageW = Math.min(plan.worldW, 14000), pageH = plan.worldH * (pageW / plan.worldW);
  const pdf = new jsPDF({ unit: 'px', format: [pageW, pageH], orientation: pageW > pageH ? 'landscape' : 'portrait', hotfixes: ['px_scaling'], compress: true });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST');
  return { blob: pdf.output('blob'), width: canvas.width, height: canvas.height, mime: 'application/pdf', ext: 'pdf' };
}

export function exportFileName(projectName: string, scope: 'selection' | 'board', ext: string): string {
  const base = (projectName || 'canvas').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'canvas';
  return `${base}-${scope}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
