// Gradient model shared by the gradient editor, the SVG shape renderer and the
// export pipeline. A gradient is stored on elements as a plain CSS string
// (style.bgColor, hexColor, textColor, ...), so this module parses that string
// into an editable model and builds it back.

export type GradientKind = 'linear' | 'radial';

export interface GradientStop {
  id: string;
  /** 0-100 */
  pos: number;
  /** #rrggbb */
  color: string;
  /** 0-100 */
  alpha: number;
}

export interface GradientModel {
  kind: GradientKind;
  /** CSS angle in degrees (linear). */
  angle: number;
  /** Radial centre, 0-100 (% of the box). */
  cx: number;
  cy: number;
  stops: GradientStop[];
}

export const isGradientCss = (v: string | undefined | null): v is string =>
  !!v && /(linear|radial|conic)-gradient\(/i.test(v);

let uid = 0;
const newId = () => `s${Date.now().toString(36)}${(uid++).toString(36)}`;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

let probe: CanvasRenderingContext2D | null = null;
/** Any CSS colour -> {hex, alpha 0-100}. Falls back to white for junk. */
export function parseCssColor(css: string): { color: string; alpha: number } {
  const raw = css.trim();
  if (raw === 'transparent') return { color: '#000000', alpha: 0 };
  const hex = raw.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length === 6) return { color: `#${h.toLowerCase()}`, alpha: 100 };
    if (h.length === 8) return { color: `#${h.slice(0, 6).toLowerCase()}`, alpha: Math.round((parseInt(h.slice(6), 16) / 255) * 100) };
  }
  if (typeof document !== 'undefined') {
    if (!probe) probe = document.createElement('canvas').getContext('2d');
    if (probe) {
      probe.fillStyle = '#ffffff';
      probe.fillStyle = raw;
      const v = probe.fillStyle as string;
      if (v.startsWith('#')) return { color: v, alpha: 100 };
      const m = v.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const [r, g, b, a] = m[1].split(',').map((n) => parseFloat(n));
        const h2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
        return { color: `#${h2(r)}${h2(g)}${h2(b)}`, alpha: Math.round((a === undefined || Number.isNaN(a) ? 1 : a) * 100) };
      }
    }
  }
  return { color: '#ffffff', alpha: 100 };
}

const COLOR_RE = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|transparent)\s*(-?\d+(?:\.\d+)?%)?/g;
const DIRS: Record<string, number> = {
  top: 0, right: 90, bottom: 180, left: 270,
  'top right': 45, 'right top': 45, 'bottom right': 135, 'right bottom': 135,
  'bottom left': 225, 'left bottom': 225, 'top left': 315, 'left top': 315,
};

export function parseGradient(css: string | undefined | null): GradientModel | null {
  if (!css) return null;
  const m = css.match(/(linear|radial)-gradient\(([\s\S]*)\)\s*$/i);
  if (!m) return null;
  const kind = m[1].toLowerCase() as GradientKind;
  const body = m[2];
  let angle = 180;
  let cx = 50, cy = 50;
  // The "head" is everything before the first colour stop.
  const firstColor = body.search(/#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|transparent/);
  const head = firstColor > 0 ? body.slice(0, firstColor) : '';
  if (kind === 'linear') {
    const a = head.match(/(-?\d+(?:\.\d+)?)deg/);
    if (a) angle = parseFloat(a[1]);
    const to = head.match(/to\s+(top|bottom|left|right)(?:\s+(top|bottom|left|right))?/);
    if (to) angle = DIRS[[to[1], to[2]].filter(Boolean).join(' ')] ?? 180;
  } else {
    const at = head.match(/at\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
    if (at) { cx = parseFloat(at[1]); cy = parseFloat(at[2]); }
  }
  const raw: Array<{ c: string; p: number | null }> = [];
  COLOR_RE.lastIndex = 0;
  const rest = firstColor > 0 ? body.slice(firstColor) : body;
  let s: RegExpExecArray | null;
  while ((s = COLOR_RE.exec(rest))) raw.push({ c: s[1], p: s[2] ? parseFloat(s[2]) : null });
  if (raw.length === 0) return null;
  const stops: GradientStop[] = raw.map((r, i) => {
    const { color, alpha } = parseCssColor(r.c);
    return {
      id: newId(),
      pos: clamp(r.p ?? (raw.length === 1 ? 0 : (i / (raw.length - 1)) * 100), 0, 100),
      color,
      alpha,
    };
  });
  return { kind, angle, cx, cy, stops: sortStops(stops) };
}

export function sortStops(stops: GradientStop[]): GradientStop[] {
  return [...stops].sort((a, b) => a.pos - b.pos);
}

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16) || 0, g: parseInt(h.slice(2, 4), 16) || 0, b: parseInt(h.slice(4, 6), 16) || 0 };
};

export function stopCss(s: GradientStop): string {
  const { r, g, b } = hexToRgb(s.color);
  return s.alpha >= 100 ? s.color : `rgba(${r}, ${g}, ${b}, ${Math.round(s.alpha) / 100})`;
}

export function buildGradientCss(g: GradientModel): string {
  const stops = sortStops(g.stops).map((s) => `${stopCss(s)} ${Math.round(s.pos * 10) / 10}%`).join(', ');
  return g.kind === 'linear'
    ? `linear-gradient(${Math.round(g.angle)}deg, ${stops})`
    : `radial-gradient(circle at ${Math.round(g.cx)}% ${Math.round(g.cy)}%, ${stops})`;
}

/** Left-to-right strip of the stops: what the editor's gradient bar shows. */
export function previewBarCss(g: GradientModel): string {
  const stops = sortStops(g.stops).map((s) => `${stopCss(s)} ${Math.round(s.pos * 10) / 10}%`).join(', ');
  return `linear-gradient(90deg, ${stops})`;
}

export function colorAt(g: GradientModel, pos: number): { color: string; alpha: number } {
  const s = sortStops(g.stops);
  if (pos <= s[0].pos) return { color: s[0].color, alpha: s[0].alpha };
  if (pos >= s[s.length - 1].pos) return { color: s[s.length - 1].color, alpha: s[s.length - 1].alpha };
  for (let i = 1; i < s.length; i++) {
    if (pos <= s[i].pos) {
      const a = s[i - 1], b = s[i];
      const k = b.pos === a.pos ? 0 : (pos - a.pos) / (b.pos - a.pos);
      const ca = hexToRgb(a.color), cb = hexToRgb(b.color);
      const h = (x: number, y: number) => clamp(Math.round(x + (y - x) * k), 0, 255).toString(16).padStart(2, '0');
      return { color: `#${h(ca.r, cb.r)}${h(ca.g, cb.g)}${h(ca.b, cb.b)}`, alpha: Math.round(a.alpha + (b.alpha - a.alpha) * k) };
    }
  }
  return { color: s[s.length - 1].color, alpha: s[s.length - 1].alpha };
}

export function defaultGradient(from?: string): GradientModel {
  const base = from && !isGradientCss(from) && from !== 'transparent' ? parseCssColor(from).color : '#a855f7';
  return {
    kind: 'linear',
    angle: 135,
    cx: 50,
    cy: 50,
    stops: [
      { id: newId(), pos: 0, color: base, alpha: 100 },
      { id: newId(), pos: 100, color: '#22d3ee', alpha: 100 },
    ],
  };
}

export function newStop(g: GradientModel, pos: number): GradientStop {
  const c = colorAt(g, pos);
  return { id: newId(), pos: clamp(pos, 0, 100), color: c.color, alpha: c.alpha };
}

export function reverseStops(g: GradientModel): GradientModel {
  return { ...g, stops: sortStops(g.stops.map((s) => ({ ...s, pos: 100 - s.pos }))) };
}

/** SVG gradient geometry (objectBoundingBox units) for a model. */
export function svgGeometry(g: GradientModel) {
  if (g.kind === 'radial') return { cx: g.cx / 100, cy: g.cy / 100, r: 0.75 };
  const a = (g.angle * Math.PI) / 180;
  const dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2;
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy };
}

// ── colour-space helpers for the editor's picker ──
export function rgbToHsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) => clamp(Math.round((n + m) * 255), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export { hexToRgb };
