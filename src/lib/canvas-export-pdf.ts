// A minimal CanvasRenderingContext2D look-alike that records onto a jsPDF page.
// The export drawers in canvas-export.ts only talk to `ctx`, so handing them
// this object turns the same drawing code into vector paths and real, selectable
// text instead of pixels: sharp at any zoom and ready to print.
//
// Fidelity notes:
//  - Text uses the PDF's built-in fonts (Helvetica / Times / Courier) so it
//    stays real text. Lines that contain characters those fonts can't encode
//    (emoji, CJK, ...) are rasterised per line instead.
//  - Gradients are painted as thin vector bands clipped to the shape.

import type { jsPDF } from 'jspdf';

type Matrix = [number, number, number, number, number, number];
type Rgba = { r: number; g: number; b: number; a: number };
type PathCmd =
  | { t: 'M'; x: number; y: number }
  | { t: 'L'; x: number; y: number }
  | { t: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { t: 'Z' };

interface State {
  ctm: Matrix;
  fillStyle: string | PdfGradient;
  strokeStyle: string | PdfGradient;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  dash: number[];
  alpha: number;
  font: string;
  textAlign: string;
  textBaseline: string;
}

export class PdfGradient {
  stops: Array<{ pos: number; color: Rgba }> = [];
  constructor(
    public kind: 'linear' | 'radial',
    public coords: number[],
  ) {}
  addColorStop(pos: number, color: string) {
    this.stops.push({ pos, color: parseColor(color) });
    this.stops.sort((a, b) => a.pos - b.pos);
  }
}

let colorProbe: CanvasRenderingContext2D | null = null;
function parseColor(css: string): Rgba {
  if (!colorProbe) colorProbe = document.createElement('canvas').getContext('2d');
  if (!colorProbe) return { r: 255, g: 255, b: 255, a: 1 };
  colorProbe.fillStyle = '#000';
  colorProbe.fillStyle = css; // invalid values leave the previous one
  const v = colorProbe.fillStyle as string;
  if (v.startsWith('#')) {
    return { r: parseInt(v.slice(1, 3), 16), g: parseInt(v.slice(3, 5), 16), b: parseInt(v.slice(5, 7), 16), a: 1 };
  }
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (!m) return { r: 0, g: 0, b: 0, a: 1 };
  const [r, g, b, a] = m[1].split(',').map((n) => parseFloat(n));
  return { r, g, b, a: a === undefined || Number.isNaN(a) ? 1 : a };
}

const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

// Characters the standard PDF fonts can encode (WinAnsi, plus a few typographic marks).
const WIN_ANSI = /^[ -~ -ÿ•…–—‘’“”€™]*$/;

function pdfFontFor(family: string, weight: number, italic: boolean): { name: string; style: string } {
  const f = family.toLowerCase();
  const bold = weight >= 600;
  const style = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
  if (/mono|courier|consolas|menlo|fira code|jetbrains|source code/.test(f)) return { name: 'courier', style };
  if (/serif|georgia|times|playfair|merriweather|lora|garamond|cormorant|baskerville/.test(f) && !/sans/.test(f)) {
    return { name: 'times', style };
  }
  return { name: 'helvetica', style };
}

export class PdfContext {
  private st: State;
  private stack: State[] = [];
  private path: PathCmd[] = [];
  private cur = { x: 0, y: 0 };
  private start = { x: 0, y: 0 };
  private alphaCache = new Map<number, unknown>();
  private GStateCtor: new (o: Record<string, unknown>) => unknown;

  constructor(
    private pdf: jsPDF,
    GStateCtor: unknown,
    base: Matrix,
  ) {
    this.GStateCtor = GStateCtor as new (o: Record<string, unknown>) => unknown;
    this.st = {
      ctm: base,
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      dash: [],
      alpha: 1,
      font: '10px sans-serif',
      textAlign: 'left',
      textBaseline: 'alphabetic',
    };
  }

  // ── state ──
  get fillStyle() { return this.st.fillStyle; }
  set fillStyle(v: string | PdfGradient) { this.st.fillStyle = v; }
  get strokeStyle() { return this.st.strokeStyle; }
  set strokeStyle(v: string | PdfGradient) { this.st.strokeStyle = v; }
  get lineWidth() { return this.st.lineWidth; }
  set lineWidth(v: number) { this.st.lineWidth = v; }
  get lineCap() { return this.st.lineCap; }
  set lineCap(v: string) { this.st.lineCap = v; }
  get lineJoin() { return this.st.lineJoin; }
  set lineJoin(v: string) { this.st.lineJoin = v; }
  get globalAlpha() { return this.st.alpha; }
  set globalAlpha(v: number) { this.st.alpha = v; }
  get font() { return this.st.font; }
  set font(v: string) { this.st.font = v; }
  get textAlign() { return this.st.textAlign; }
  set textAlign(v: string) { this.st.textAlign = v; }
  get textBaseline() { return this.st.textBaseline; }
  set textBaseline(v: string) { this.st.textBaseline = v; }
  setLineDash(d: number[]) { this.st.dash = d.slice(); }

  save() {
    this.stack.push({ ...this.st, dash: this.st.dash.slice() });
    this.pdf.saveGraphicsState();
  }
  restore() {
    const s = this.stack.pop();
    if (s) this.st = s;
    this.pdf.restoreGraphicsState();
  }

  // ── transforms ──
  translate(x: number, y: number) { this.st.ctm = mul(this.st.ctm, [1, 0, 0, 1, x, y]); }
  scale(x: number, y: number) { this.st.ctm = mul(this.st.ctm, [x, 0, 0, y, 0, 0]); }
  rotate(a: number) {
    const c = Math.cos(a), s = Math.sin(a);
    this.st.ctm = mul(this.st.ctm, [c, s, -s, c, 0, 0]);
  }
  private tp(x: number, y: number) {
    const m = this.st.ctm;
    return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
  }
  private get scaleFactor() {
    const m = this.st.ctm;
    return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  }

  // ── path ──
  beginPath() { this.path = []; }
  moveTo(x: number, y: number) {
    const p = this.tp(x, y);
    this.path.push({ t: 'M', ...p });
    this.cur = { x, y };
    this.start = { x, y };
  }
  lineTo(x: number, y: number) {
    const p = this.tp(x, y);
    if (this.path.length === 0) this.path.push({ t: 'M', ...p });
    else this.path.push({ t: 'L', ...p });
    this.cur = { x, y };
  }
  closePath() {
    this.path.push({ t: 'Z' });
    this.cur = { ...this.start };
  }
  rect(x: number, y: number, w: number, h: number) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  }
  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    const a = this.tp(x1, y1), b = this.tp(x2, y2), c = this.tp(x, y);
    this.path.push({ t: 'C', x1: a.x, y1: a.y, x2: b.x, y2: b.y, x: c.x, y: c.y });
    this.cur = { x, y };
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    const { x: x0, y: y0 } = this.cur;
    this.bezierCurveTo(x0 + (2 / 3) * (cx - x0), y0 + (2 / 3) * (cy - y0), x + (2 / 3) * (cx - x), y + (2 / 3) * (cy - y), x, y);
  }
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number) {
    const { x: x0, y: y0 } = this.cur;
    const v1 = { x: x0 - x1, y: y0 - y1 }, v2 = { x: x2 - x1, y: y2 - y1 };
    const l1 = Math.hypot(v1.x, v1.y), l2 = Math.hypot(v2.x, v2.y);
    if (!l1 || !l2 || !r) { this.lineTo(x1, y1); return; }
    const cos = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2);
    const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (Math.abs(Math.sin(ang)) < 1e-6) { this.lineTo(x1, y1); return; }
    const t = r / Math.tan(ang / 2);
    const p1 = { x: x1 + (v1.x / l1) * t, y: y1 + (v1.y / l1) * t };
    const p2 = { x: x1 + (v2.x / l2) * t, y: y1 + (v2.y / l2) * t };
    this.lineTo(p1.x, p1.y);
    // Quarter-ish arc between the tangent points via one cubic (kappa for the turn angle).
    const sweep = Math.PI - ang;
    const k = (4 / 3) * Math.tan(sweep / 4) * r;
    this.bezierCurveTo(
      p1.x - (v1.x / l1) * k, p1.y - (v1.y / l1) * k,
      p2.x - (v2.x / l2) * k, p2.y - (v2.y / l2) * k,
      p2.x, p2.y,
    );
  }
  arc(cx: number, cy: number, r: number, a0: number, a1: number, ccw = false) {
    let sweep = a1 - a0;
    if (!ccw && sweep < 0) sweep = (sweep % (Math.PI * 2)) + Math.PI * 2;
    if (ccw && sweep > 0) sweep = (sweep % (Math.PI * 2)) - Math.PI * 2;
    if (Math.abs(sweep) > Math.PI * 2) sweep = Math.sign(sweep) * Math.PI * 2;
    const segs = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
    const step = sweep / segs;
    const k = (4 / 3) * Math.tan(step / 4);
    let a = a0;
    const sx = cx + Math.cos(a) * r, sy = cy + Math.sin(a) * r;
    if (this.path.length === 0) this.moveTo(sx, sy);
    else this.lineTo(sx, sy);
    for (let i = 0; i < segs; i++) {
      const b = a + step;
      const c1 = { x: cx + Math.cos(a) * r - Math.sin(a) * r * k, y: cy + Math.sin(a) * r + Math.cos(a) * r * k };
      const c2 = { x: cx + Math.cos(b) * r + Math.sin(b) * r * k, y: cy + Math.sin(b) * r - Math.cos(b) * r * k };
      this.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, cx + Math.cos(b) * r, cy + Math.sin(b) * r);
      a = b;
    }
  }

  // ── gradients ──
  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    return new PdfGradient('linear', [x0, y0, x1, y1]);
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    return new PdfGradient('radial', [x0, y0, r0, x1, y1, r1]);
  }

  // ── painting ──
  private emitPath(cmds: PathCmd[] = this.path) {
    const pdf = this.pdf;
    for (const c of cmds) {
      if (c.t === 'M') pdf.moveTo(c.x, c.y);
      else if (c.t === 'L') pdf.lineTo(c.x, c.y);
      else if (c.t === 'C') pdf.curveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
      else pdf.close();
    }
  }

  private setAlpha(a: number) {
    const key = Math.round(Math.max(0, Math.min(1, a)) * 1000) / 1000;
    let gs = this.alphaCache.get(key);
    if (!gs) {
      gs = new this.GStateCtor({ opacity: key, 'stroke-opacity': key });
      this.alphaCache.set(key, gs);
    }
    this.pdf.setGState(gs as never);
  }

  private solid(c: Rgba, forStroke: boolean) {
    const r = Math.round(c.r), g = Math.round(c.g), b = Math.round(c.b);
    if (forStroke) this.pdf.setDrawColor(r, g, b);
    else this.pdf.setFillColor(r, g, b);
    this.setAlpha(c.a * this.st.alpha);
  }

  fill() {
    if (this.path.length === 0) return;
    const style = this.st.fillStyle;
    if (typeof style === 'string') {
      const c = parseColor(style);
      if (c.a * this.st.alpha <= 0) return;
      this.solid(c, false);
      this.emitPath();
      this.pdf.fill();
      return;
    }
    // Gradient: clip to the path, then paint it as one bitmap.
    this.pdf.saveGraphicsState();
    this.emitPath();
    this.pdf.clip();
    this.pdf.discardPath();
    this.paintGradient(style);
    this.pdf.restoreGraphicsState();
  }

  stroke() {
    if (this.path.length === 0) return;
    const style = this.st.strokeStyle;
    const c = typeof style === 'string' ? parseColor(style) : style.stops[0]?.color ?? { r: 255, g: 255, b: 255, a: 1 };
    if (c.a * this.st.alpha <= 0 || this.st.lineWidth <= 0) return;
    this.solid(c, true);
    const sf = this.scaleFactor;
    this.pdf.setLineWidth(this.st.lineWidth * sf);
    this.pdf.setLineCap(this.st.lineCap === 'round' ? 1 : this.st.lineCap === 'square' ? 2 : 0);
    this.pdf.setLineJoin(this.st.lineJoin === 'round' ? 1 : this.st.lineJoin === 'bevel' ? 2 : 0);
    this.pdf.setLineDashPattern(this.st.dash.map((d) => d * sf), 0);
    this.emitPath();
    this.pdf.stroke();
    this.pdf.setLineDashPattern([], 0);
  }

  clip() {
    if (this.path.length === 0) return;
    this.emitPath();
    this.pdf.clip();
    this.pdf.discardPath();
  }

  fillRect(x: number, y: number, w: number, h: number) {
    const saved = this.path;
    this.path = [];
    this.rect(x, y, w, h);
    this.fill();
    this.path = saved;
  }

  /**
   * Paints a gradient into the current clip as one smooth bitmap. Vector bands
   * left visible seams wherever a gradient or the shape opacity was translucent
   * (bands either gap or double up their alpha); a bitmap has neither problem,
   * and the shape outline, stroke and text stay vector.
   */
  private paintGradient(g: PdfGradient) {
    if (g.stops.length === 0 || this.path.length === 0) return;
    // Device-space bounds of the path being filled.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of this.path) {
      if (c.t === 'Z') continue;
      const pts = c.t === 'C' ? [[c.x1, c.y1], [c.x2, c.y2], [c.x, c.y]] : [[c.x, c.y]];
      for (const [px, py] of pts) {
        minX = Math.min(minX, px); minY = Math.min(minY, py);
        maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
      }
    }
    const bw = maxX - minX, bh = maxY - minY;
    if (!(bw > 0) || !(bh > 0)) return;
    const res = Math.min(3, 1400 / Math.max(bw, bh));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(bw * res));
    cv.height = Math.max(1, Math.ceil(bh * res));
    const cx = cv.getContext('2d');
    if (!cx) return;
    const dev = (x: number, y: number) => {
      const p = this.tp(x, y);
      return { x: (p.x - minX) * res, y: (p.y - minY) * res };
    };
    let grad: CanvasGradient;
    if (g.kind === 'linear') {
      const a = dev(g.coords[0], g.coords[1]), b = dev(g.coords[2], g.coords[3]);
      grad = cx.createLinearGradient(a.x, a.y, b.x, b.y);
    } else {
      const a = dev(g.coords[0], g.coords[1]), b = dev(g.coords[3], g.coords[4]);
      const k = this.scaleFactor * res;
      grad = cx.createRadialGradient(a.x, a.y, g.coords[2] * k, b.x, b.y, g.coords[5] * k);
    }
    for (const st of g.stops) {
      grad.addColorStop(Math.max(0, Math.min(1, st.pos)), `rgba(${Math.round(st.color.r)},${Math.round(st.color.g)},${Math.round(st.color.b)},${st.color.a})`);
    }
    cx.fillStyle = grad;
    cx.fillRect(0, 0, cv.width, cv.height);
    this.setAlpha(this.st.alpha);
    try {
      this.pdf.addImage(cv.toDataURL('image/png'), 'PNG', minX, minY, bw, bh, undefined, 'FAST');
    } catch { /* leave the area unfilled rather than failing the export */ }
  }

  // ── text ──
  private parseFont() {
    // "[italic] [weight] <size>px <family>"; the weight is optional (e.g. "36px Inter").
    const m = this.st.font.match(/^(italic\s+)?(?:(\d+|bold|normal)\s+)?([\d.]+)px\s+(.+)$/);
    const italic = !!m?.[1];
    const w = m?.[2];
    const weight = w === 'bold' ? 700 : w && /^\d+$/.test(w) ? parseInt(w, 10) : 400;
    const size = m ? parseFloat(m[3]) : 10;
    const family = m ? m[4] : 'sans-serif';
    return { italic, weight, size, family };
  }

  private applyFont() {
    const f = this.parseFont();
    const pf = pdfFontFor(f.family, f.weight, f.italic);
    this.pdf.setFont(pf.name, pf.style);
    // measureText runs in unscaled canvas units, so measure at the CSS size.
    this.pdf.setFontSize(f.size);
    return f;
  }

  measureText(text: string): { width: number } {
    const f = this.applyFont();
    // The document unit is pt and font sizes are pt, so widths are in canvas units.
    let w = this.pdf.getTextWidth(text);
    if (!WIN_ANSI.test(text)) {
      // Fallback glyphs are rasterised with the real canvas font: measure that.
      if (!colorProbe) colorProbe = document.createElement('canvas').getContext('2d');
      if (colorProbe) {
        colorProbe.font = this.st.font;
        w = colorProbe.measureText(text).width;
      }
    }
    return { width: w };
  }

  fillText(text: string, x: number, y: number) {
    if (!text) return;
    const style = this.st.fillStyle;
    const c = typeof style === 'string' ? parseColor(style) : style.stops[0]?.color ?? { r: 255, g: 255, b: 255, a: 1 };
    if (c.a * this.st.alpha <= 0) return;
    const f = this.applyFont();
    const sf = this.scaleFactor;
    const m = this.st.ctm;
    const angle = (-Math.atan2(m[1], m[0]) * 180) / Math.PI;
    const p = this.tp(x, y);

    if (!WIN_ANSI.test(text)) {
      this.rasterText(text, x, y, f.size, c);
      return;
    }
    this.pdf.setFontSize(f.size * sf);
    this.pdf.setTextColor(Math.round(c.r), Math.round(c.g), Math.round(c.b));
    this.setAlpha(c.a * this.st.alpha);
    const baseline = this.st.textBaseline === 'top' ? 'top' : this.st.textBaseline === 'middle' ? 'middle' : 'alphabetic';
    const align = this.st.textAlign === 'center' ? 'center' : this.st.textAlign === 'right' || this.st.textAlign === 'end' ? 'right' : 'left';
    this.pdf.text(text, p.x, p.y, { baseline, align, angle: Math.abs(angle) < 0.01 ? undefined : angle } as never);
    this.pdf.setFontSize(f.size);
  }

  private rasterText(text: string, x: number, y: number, size: number, c: Rgba) {
    const sf = this.scaleFactor;
    const res = 4; // pixels per PDF unit
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) return;
    probe.font = this.st.font;
    const tw = probe.measureText(text).width;
    // Draw with the SAME baseline/alignment the caller asked for, inside a canvas
    // with generous margins (emoji ascend/descend past the font size), then place
    // the bitmap so its anchor lands exactly on (x, y).
    const padX = Math.ceil(size * 0.5) + 2;
    const padY = Math.ceil(size * 1.2);
    const w = Math.ceil(tw) + padX * 2;
    const h = padY * 2 + Math.ceil(size);
    const align = this.st.textAlign === 'center' ? 'center' : this.st.textAlign === 'right' || this.st.textAlign === 'end' ? 'right' : 'left';
    const ax = align === 'center' ? w / 2 : align === 'right' ? w - padX : padX;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * sf * res));
    cv.height = Math.max(1, Math.ceil(h * sf * res));
    const cx = cv.getContext('2d');
    if (!cx) return;
    cx.scale(sf * res, sf * res);
    cx.font = this.st.font;
    cx.textBaseline = this.st.textBaseline as CanvasTextBaseline;
    cx.textAlign = align;
    cx.fillStyle = `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
    cx.fillText(text, ax, padY);
    const p = this.tp(x - ax, y - padY);
    this.setAlpha(c.a * this.st.alpha);
    try {
      this.pdf.addImage(cv.toDataURL('image/png'), 'PNG', p.x, p.y, w * sf, h * sf, undefined, 'FAST');
    } catch { /* an unrenderable glyph run is skipped, never fatal */ }
  }

  drawImage(img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
    const a = this.tp(dx, dy), b = this.tp(dx + dw, dy + dh);
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    if (w <= 0 || h <= 0) return;
    const m = this.st.ctm;
    const flipH = m[0] < 0, flipV = m[3] < 0;
    const maxSide = 2400;
    const k = Math.min(1, maxSide / Math.max(sw, sh));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(sw * k));
    cv.height = Math.max(1, Math.round(sh * k));
    const cx = cv.getContext('2d');
    if (!cx) return;
    cx.translate(flipH ? cv.width : 0, flipV ? cv.height : 0);
    cx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    cx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    this.setAlpha(this.st.alpha);
    try {
      this.pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, w, h, undefined, 'FAST');
    } catch { /* tainted/cross-origin image: leave the clipped area empty */ }
  }
}
