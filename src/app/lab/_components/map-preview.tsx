"use client";

// Lightweight SVG preview of canvas elements, faithful enough to judge
// structure and clarity. It does not mount the real canvas (store, Yjs,
// collaboration); it mirrors what the canvas paints:
//   - connectors: connectorPath from connector-geometry (the pure mirror of
//     cxd-canvas getResolvedEdgePoints + the per-edge <path>): side anchors,
//     2px outset, cubic handles perpendicular to each side, straight when
//     nearly aligned. edge.bend is ignored, as on the canvas. Stroke is the
//     dark-mid-light gradient along from->to with the 0.18 glow underlay, glass
//     orbs at both ends, anchor-aligned arrow triangles and the midpoint dot.
//   - connector labels: the opaque 60x20 card-coloured pill at label.position.
//   - line elements: linePath (quadratic through bend, midpoint when absent),
//     light->mid gradient, line-layer end caps.
//   - z-order: open lines (no container) under everything, then elements by
//     zIndex (containers first), then in-container lines, then every connector
//     above all elements (edge z = max element z + 1), in edge order.
// What wins here must be what the user will see on the canvas.
import { useId } from "react";
import { Globe, ImagePlus, Layers, LayoutGrid } from "lucide-react";
import type {
  BoardElement, CanvasEdge, CanvasElement, ContainerElement, ExperienceBlockElement,
  FreeformElement, ImageElement, LineElement, LineEndStyle, LinkElement, ShapeElement,
  TableElement, TextElement,
} from "@/types/canvas-elements";
import { connectorHull, connectorPath, linePath, resolveEdgePoints, LABEL_PILL, type Pt } from "@/lib/maps/connector-geometry";
import { realBounds, type Box } from "@/lib/canvas-layout-rules";
import { getGradient, type GradientName } from "@/components/cxd/canvas/connector-gradients";

/** Canvas default background (cxd-canvas canvasBackground), ending on zinc-950 rather than pure black. */
const CANVAS_BG = "radial-gradient(circle at center, #1a0b2e 0%, #09090b 100%)";
/** FreeformCard / ExperienceBlockCard default fill. */
const CARD_BG = "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)";
/** BoardCard default hexagon fill. */
const HEX_BG = "linear-gradient(135deg, #a78bfa 0%, #7c3aed 30%, #5b21b6 70%, #4c1d95 100%)";

const boxOf = (e: CanvasElement): Box => realBounds(e) ?? { x: e.x, y: e.y, w: e.width, h: e.height };
const centre = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const rgb = (hex: string) => `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`;
const gradientOf = (name: string | undefined) => getGradient((name as GradientName | undefined) ?? undefined) ?? getGradient("violet");

function Html({ box, children, className = "", style }: { box: Box; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <foreignObject x={box.x} y={box.y} width={Math.max(0, box.w)} height={Math.max(0, box.h)}>
      <div className={`h-full w-full overflow-hidden ${className}`} style={style}>{children}</div>
    </foreignObject>
  );
}

// ─── Elements ────────────────────────────────────────────────────────

function Container({ el, childCount }: { el: ContainerElement; childCount: number }) {
  const t = gradientOf(el.tintColor);
  const b = boxOf(el);
  return (
    <Html box={b}>
      <div
        className="flex h-full w-full flex-col overflow-hidden"
        style={{
          borderRadius: 14,
          background: `rgba(${rgb(t.mid)},0.08)`,
          border: `1px solid rgba(${rgb(t.mid)},0.35)`,
          boxShadow: `inset 0 0 30px rgba(${rgb(t.mid)},0.06)`,
        }}
      >
        {!el.hideLabel && (
          <div
            className="flex flex-shrink-0 items-center gap-1.5 px-2"
            style={{ height: 28, background: `rgba(${rgb(t.mid)},0.12)`, borderBottom: `1px solid rgba(${rgb(t.mid)},0.2)` }}
          >
            <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${t.light}, ${t.mid})` }} />
            <span className="min-w-0 flex-1 truncate" style={{ color: `rgba(${rgb(t.light)},0.85)`, fontFamily: "'Poppins', sans-serif", fontSize: 17, fontWeight: 600 }}>
              {el.label || "Name"}
            </span>
            <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[9px]" style={{ color: `rgba(${rgb(t.light)},0.45)`, background: `rgba(${rgb(t.mid)},0.10)`, fontFamily: "monospace" }}>
              {childCount} {childCount === 1 ? "item" : "items"}
            </span>
          </div>
        )}
      </div>
    </Html>
  );
}

function Freeform({ el }: { el: FreeformElement }) {
  const b = boxOf(el);
  const textColor = el.style?.textColor || "#ffffff";
  const isNote = el.cardType === "note" || (!el.cardType && !!el.noteTitle);
  const body = strip(el.noteBody ?? el.content ?? "");
  return (
    <Html box={b}>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-lg"
        style={{
          background: el.style?.bgColor || CARD_BG,
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.1) inset",
          color: textColor,
        }}
      >
        {el.emoji && <div className="w-full py-[7px] text-center text-lg leading-none">{el.emoji}</div>}
        <div className={`flex min-h-0 flex-1 flex-col gap-2 p-3 ${el.emoji ? "" : "pt-0"}`}>
          {isNote ? (
            <>
              {!el.hideNoteTitle && (
                <>
                  <div className="break-words px-0.5 py-0.5 text-lg font-semibold" style={{ whiteSpace: "pre-wrap" }}>
                    {el.noteTitle || "Untitled Note"}
                  </div>
                  <div className="h-px bg-white/10" />
                </>
              )}
              <div className="min-h-0 flex-1 overflow-hidden break-words px-0.5 py-0.5 text-sm leading-relaxed">
                {body || <span className="text-white/40">Write your note...</span>}
              </div>
            </>
          ) : (
            <div className="break-words text-xl font-bold" style={{ whiteSpace: "pre-wrap" }}>{el.content || "Untitled"}</div>
          )}
        </div>
      </div>
    </Html>
  );
}

function Shape({ el }: { el: ShapeElement }) {
  const b = boxOf(el);
  const fill = el.style?.bgColor || "hsl(var(--primary) / 0.3)";
  const stroke = el.style?.borderColor || "hsl(var(--primary))";
  const sw = el.style?.borderWidth || 2;
  // ShapeCard draws in a 0..100 viewBox stretched to the box (preserveAspectRatio none).
  const sx = (v: number) => b.x + (v / 100) * b.w;
  const sy = (v: number) => b.y + (v / 100) * b.h;
  const poly = (pts: [number, number][]) => pts.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ");
  let body: React.ReactNode;
  switch (el.shapeType) {
    case "circle":
      body = <ellipse cx={sx(50)} cy={sy(50)} rx={(48 / 100) * b.w} ry={(48 / 100) * b.h} fill={fill} stroke={stroke} strokeWidth={sw} />;
      break;
    case "diamond":
      body = <polygon points={poly([[50, 5], [95, 50], [50, 95], [5, 50]])} fill={fill} stroke={stroke} strokeWidth={sw} />;
      break;
    case "triangle":
      body = <polygon points={poly([[50, 5], [95, 95], [5, 95]])} fill={fill} stroke={stroke} strokeWidth={sw} />;
      break;
    case "hexagon":
      body = <polygon points={poly([[25, 5], [75, 5], [95, 50], [75, 95], [25, 95], [5, 50]])} fill={fill} stroke={stroke} strokeWidth={sw} />;
      break;
    default:
      body = <rect x={sx(2)} y={sy(2)} width={(96 / 100) * b.w} height={(96 / 100) * b.h} rx={8} fill={fill} stroke={stroke} strokeWidth={sw} />;
  }
  return (
    <g>
      {body}
      <Html
        box={b}
        className="flex items-center justify-center"
        style={{
          padding: "8%",
          textAlign: el.style?.textAlign || "center",
          color: el.style?.textColor || "inherit",
          fontSize: el.style?.fontSize || 14,
          fontWeight: el.style?.fontWeight === "300" ? 300 : el.style?.fontWeight || "normal",
          lineHeight: 1.3,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {el.content ?? ""}
      </Html>
    </g>
  );
}

function Board({ el }: { el: BoardElement }) {
  const c = centre(boxOf(el));
  // BoardCard: a fixed 128x128 pointy-top hexagon centred in the element, title 72px below centre.
  const hex = { x: c.x - 64, y: c.y - 64, w: 128, h: 128 };
  return (
    <g>
      <Html box={hex} className="relative flex items-center justify-center">
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)",
            background: el.hexColor || HEX_BG,
          }}
        />
        <LayoutGrid className="relative h-12 w-12 text-white" aria-hidden />
      </Html>
      <Html box={{ x: c.x - 120, y: c.y + 72, w: 240, h: 48 }} className="flex flex-col items-center gap-1">
        <div className="max-w-full truncate whitespace-nowrap px-2 py-1 text-sm font-medium text-white">{el.title || "New Board"}</div>
        <div className="whitespace-nowrap text-xs font-medium text-purple-400">0 Items</div>
      </Html>
    </g>
  );
}

function ExperienceBlock({ el }: { el: ExperienceBlockElement }) {
  return (
    <Html box={boxOf(el)}>
      <div
        className="flex h-full w-full items-center gap-3 rounded-lg border px-4 py-3"
        style={{ background: el.style?.bgColor || CARD_BG, borderColor: "rgba(168,85,247,0.3)", boxShadow: "0 4px 16px rgba(168,85,247,0.2)" }}
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: "hsl(var(--primary) / 0.2)" }}>
          <Layers className="h-5 w-5 text-white" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{el.title}</div>
          <div className="mt-0.5 text-xs text-white/50">Double-click to open</div>
        </div>
      </div>
    </Html>
  );
}

function Table({ el }: { el: TableElement }) {
  const b = boxOf(el);
  const cells = el.cells ?? [];
  const rows = Math.max(1, cells.length);
  const cols = Math.max(1, cells[0]?.length ?? 1);
  const lineColor = el.lineColor || el.borderColor || "rgba(139,92,246,0.28)";
  const lw = el.lineWidth ?? 1;
  const cw = b.w / cols;
  const ch = b.h / rows;
  return (
    <g>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={el.tableBg || "transparent"} />
      {el.headerRow && !el.tableBg && <rect x={b.x} y={b.y} width={b.w} height={ch} fill="rgba(139,92,246,0.22)" />}
      {cells.map((row, r) => row.map((cell, c) => (
        <Html key={`${r}-${c}`} box={{ x: b.x + c * cw, y: b.y + r * ch, w: cw, h: ch }} className="flex items-center px-2">
          <span
            className="truncate"
            style={{
              fontSize: cell.fontSize === "sm" ? 12 : cell.fontSize === "lg" ? 18 : 14,
              color: cell.color || "rgba(255,255,255,0.85)",
              fontWeight: cell.bold || (el.headerRow && r === 0) ? 600 : 400,
            }}
          >
            {cell.text}
          </span>
        </Html>
      )))}
      {lw > 0 && (
        <g stroke={lineColor} strokeWidth={lw}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" />
          {Array.from({ length: rows - 1 }, (_, r) => <line key={`h${r}`} x1={b.x} x2={b.x + b.w} y1={b.y + (r + 1) * ch} y2={b.y + (r + 1) * ch} />)}
          {Array.from({ length: cols - 1 }, (_, c) => <line key={`v${c}`} y1={b.y} y2={b.y + b.h} x1={b.x + (c + 1) * cw} x2={b.x + (c + 1) * cw} />)}
        </g>
      )}
    </g>
  );
}

function ImageEl({ el }: { el: ImageElement }) {
  const b = boxOf(el);
  if (!el.storyboard) {
    return (
      <Html box={b}>
        <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-white/20">
          <ImagePlus className="h-8 w-8 text-white/30" aria-hidden />
        </div>
      </Html>
    );
  }
  const ratio = el.storyboardCaptionRatio ?? 0.28;
  return (
    <Html box={b}>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-md"
        style={{ border: `${el.storyboardBorderWidth ?? 3}px solid ${el.storyboardBorderColor || "#b8b8be"}`, background: el.storyboardBgColor || "#0f0f12" }}
      >
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <ImagePlus className="h-8 w-8 text-white/30" aria-hidden />
        </div>
        <div className="overflow-hidden px-2 py-1 leading-snug" style={{ height: `${ratio * 100}%`, color: el.storyboardTextColor || "#f4f4f5", fontSize: 14 }}>
          {el.description || <span className="text-white/30">Add a caption...</span>}
        </div>
      </div>
    </Html>
  );
}

function Link({ el }: { el: LinkElement }) {
  return (
    <Html box={boxOf(el)}>
      <div className="flex h-full w-full items-center gap-3 overflow-hidden rounded-lg border border-white/10 p-3" style={{ background: "hsl(var(--card))" }}>
        <Globe className="h-8 w-8 flex-shrink-0 text-white/30" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-semibold leading-snug" style={{ color: "hsl(var(--foreground))" }}>{el.title || el.domain || "Link"}</div>
          <div className="mt-1 truncate text-xs text-white/50">{el.domain || el.url}</div>
        </div>
      </div>
    </Html>
  );
}

function Text({ el }: { el: TextElement }) {
  return (
    <Html
      box={boxOf(el)}
      style={{
        fontSize: el.style?.fontSize || 16,
        fontWeight: el.style?.fontWeight === "300" ? 300 : el.style?.fontWeight || "normal",
        color: el.style?.textColor || "#ffffff",
        textAlign: el.textAlign || el.style?.textAlign || "left",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {el.content}
    </Html>
  );
}

function ElementShape({ el, childCount }: { el: CanvasElement; childCount: number }) {
  switch (el.type) {
    case "container": return <Container el={el} childCount={childCount} />;
    case "freeform": return <Freeform el={el} />;
    case "shape": return <Shape el={el} />;
    case "board": return <Board el={el} />;
    case "experienceBlock": return <ExperienceBlock el={el} />;
    case "table": return <Table el={el} />;
    case "image": return <ImageEl el={el} />;
    case "link": return <Link el={el} />;
    case "text": return <Text el={el} />;
    default: return null;
  }
}

// ─── Lines (line-layer.tsx renderLine) ───────────────────────────────

function lineCap(cap: LineEndStyle | undefined, p: Pt, angle: number, color: string, size: number) {
  if (!cap || cap === "none") return null;
  const half = size / 2;
  const rot = (pts: [number, number][]) =>
    pts.map(([x, y]) => `${p.x + x * Math.cos(angle) - y * Math.sin(angle)},${p.y + x * Math.sin(angle) + y * Math.cos(angle)}`).join(" ");
  switch (cap) {
    case "dot": return <circle cx={p.x} cy={p.y} r={half} fill={color} />;
    case "arrow": return <polygon points={rot([[size, 0], [0, -half * 0.8], [size * 0.3, 0], [0, half * 0.8]])} fill={color} />;
    case "square": return <polygon points={rot([[half, -half], [half, half], [-half, half], [-half, -half]])} fill={color} />;
    case "diamond": return <polygon points={rot([[half, 0], [0, half], [-half, 0], [0, -half]])} fill={color} />;
    default: return null;
  }
}

function Line({ el, gid }: { el: LineElement; gid: string }) {
  if (!el.start || !el.end) return null;
  const { d } = linePath(el);
  const s = el.start;
  const t = el.end;
  const c = el.bend ?? { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
  const grad = el.style?.gradientName ? getGradient(el.style.gradientName) : null;
  const color = grad ? grad.mid : el.style?.color || "hsl(180 100% 50%)";
  const width = el.style?.widthPx || 2;
  const kind = el.style?.kind || "solid";
  const capSize = Math.max(8, width * 3);
  return (
    <g>
      {grad && (
        <defs>
          <linearGradient id={gid} x1={s.x} y1={s.y} x2={t.x} y2={t.y} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={grad.light} />
            <stop offset="100%" stopColor={grad.mid} />
          </linearGradient>
        </defs>
      )}
      <path d={d} fill="none" stroke={grad ? `url(#${gid})` : color} strokeWidth={width} strokeLinecap="round"
        strokeDasharray={kind === "dashed" ? "10 8" : kind === "dotted" ? "2 8" : undefined} />
      {lineCap(el.style?.startCap, s, Math.atan2(s.y - c.y, s.x - c.x), color, capSize)}
      {lineCap(el.style?.endCap, t, Math.atan2(t.y - c.y, t.x - c.x), color, capSize)}
    </g>
  );
}

// ─── Connectors (cxd-canvas per-edge SVG) ────────────────────────────

type Side = "top" | "right" | "bottom" | "left";

/** The canvas's anchor-aligned arrow triangle at p, pointing into the element on `side`. */
function arrowPoints(p: Pt, side: Side, thickness: number): string {
  const tip = 4 + thickness * 0.85;
  const back = 1.5 + thickness * 0.4;
  const half = 2 + thickness * 0.6;
  switch (side) {
    case "left": return `${p.x + tip},${p.y} ${p.x - back},${p.y - half} ${p.x - back},${p.y + half}`;
    case "right": return `${p.x - tip},${p.y} ${p.x + back},${p.y - half} ${p.x + back},${p.y + half}`;
    case "top": return `${p.x},${p.y + tip} ${p.x - half},${p.y - back} ${p.x + half},${p.y - back}`;
    case "bottom": return `${p.x},${p.y - tip} ${p.x - half},${p.y + back} ${p.x + half},${p.y + back}`;
  }
}

function Orb({ p, core, rim }: { p: Pt; core: string; rim: string }) {
  return (
    <g>
      <circle cx={p.x} cy={p.y} r={9} fill={rim} opacity={0.15} />
      <circle cx={p.x} cy={p.y} r={5.5} fill={core} fillOpacity={0.3} stroke={rim} strokeWidth={1} strokeOpacity={0.62} />
      <circle cx={p.x} cy={p.y} r={1.8} fill={rim} opacity={0.85} />
    </g>
  );
}

function Connector({ edge, from, to, gid }: { edge: CanvasEdge; from: CanvasElement; to: CanvasElement; gid: string }) {
  const path = connectorPath(edge, from, to);
  const { a, b, fromSide, toSide } = resolveEdgePoints(edge, from, to);
  const style = edge.style ?? {};
  const grad = gradientOf(style.gradientName);
  const thickness = style.thickness || 2;
  const arrow = style.arrowStyle;
  const rev = !!style.gradientReversed;
  const label = edge.label?.text ? { at: path.at(edge.label.position ?? 0.5), ...edge.label } : null;
  return (
    <g>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse"
          x1={rev ? b.x : a.x} y1={rev ? b.y : a.y} x2={rev ? a.x : b.x} y2={rev ? a.y : b.y}>
          <stop offset="0%" stopColor={grad.dark} />
          <stop offset="50%" stopColor={grad.mid} />
          <stop offset="100%" stopColor={grad.light} />
        </linearGradient>
      </defs>
      <path d={path.d} fill="none" stroke={`url(#${gid})`} strokeWidth={thickness * 3} strokeLinecap="round" opacity={0.18} />
      <path d={path.d} fill="none" stroke={`url(#${gid})`} strokeWidth={thickness} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={style.lineStyle === "dashed" ? "8,4" : style.lineStyle === "dotted" ? "2,4" : undefined} />
      {label && (
        <g>
          <rect x={label.at.x - LABEL_PILL.w / 2} y={label.at.y - LABEL_PILL.h / 2} width={LABEL_PILL.w} height={LABEL_PILL.h} rx={4}
            fill="hsl(var(--card))" fillOpacity={0.9} />
          <text x={label.at.x} y={label.at.y + 4} textAnchor="middle" fill={label.color || "hsl(var(--foreground))"}
            fontSize={label.fontSize || 12} fontFamily={label.fontFamily || "inherit"}>
            {label.text}
          </text>
        </g>
      )}
      <Orb p={a} core={grad.mid} rim={grad.mid} />
      {(arrow === "start" || arrow === "both") && <polygon points={arrowPoints(a, fromSide, thickness)} fill={grad.mid} opacity={0.9} />}
      <Orb p={b} core={grad.light} rim={grad.light} />
      {(arrow === "end" || arrow === "both") && <polygon points={arrowPoints(b, toSide, thickness)} fill={grad.light} opacity={0.9} />}
      <circle cx={path.mid.x} cy={path.mid.y} r={3.5} fill={grad.mid} opacity={0.75} stroke={grad.light} strokeWidth={0.8} strokeOpacity={0.5} />
    </g>
  );
}

// ─── Preview ─────────────────────────────────────────────────────────

export interface MapPreviewProps {
  elements: CanvasElement[];
  edges: CanvasEdge[];
  height?: number;
  /** Accessible name, e.g. "Map A". */
  label?: string;
}

export function MapPreview({ elements, edges, height = 360, label = "Map preview" }: MapPreviewProps) {
  const uid = useId().replace(/:/g, "");
  const drawn = elements.filter((e) => e.type !== "connector");

  if (drawn.length === 0) {
    return (
      <div
        role="img"
        aria-label={`${label}: nothing to preview`}
        className="flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-zinc-900/60 text-sm text-zinc-400"
        style={{ height }}
      >
        Nothing to preview
      </div>
    );
  }

  const byId = new Map<string, CanvasElement>();
  drawn.forEach((e) => byId.set(e.id, e));
  const liveEdges = edges.filter((e) => byId.has(e.fromNodeId) && byId.has(e.toNodeId) && e.fromNodeId !== e.toNodeId);

  // World bounds: every box, every line (with its bend) and every connector's control hull.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x: number, y: number) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const el of drawn) {
    if (el.type === "line") {
      const l = el as LineElement;
      if (!l.start || !l.end) continue;
      grow(l.start.x, l.start.y);
      grow(l.end.x, l.end.y);
      if (l.bend) grow(l.bend.x, l.bend.y);
    } else {
      const b = boxOf(el);
      grow(b.x, b.y);
      grow(b.x + b.w, b.y + b.h);
    }
  }
  for (const e of liveEdges) {
    const h = connectorHull(e, byId.get(e.fromNodeId)!, byId.get(e.toNodeId)!);
    grow(h.x0, h.y0);
    grow(h.x1, h.y1);
  }
  const pad = 60;
  const vx = x0 - pad;
  const vy = y0 - pad;
  const vw = Math.max(1, x1 - x0 + pad * 2);
  const vh = Math.max(1, y1 - y0 + pad * 2);

  const childCount = new Map<string, number>();
  drawn.forEach((e) => { if (e.containerId) childCount.set(e.containerId, (childCount.get(e.containerId) ?? 0) + 1); });

  const lines = drawn.filter((e): e is LineElement => e.type === "line");
  const openLines = lines.filter((l) => !l.containerId);
  const containerLines = lines.filter((l) => !!l.containerId);
  // Stable sort by zIndex: containers (z 0) paint under their cards (z 1).
  const boxes = drawn
    .filter((e) => e.type !== "line")
    .map((e, i) => ({ e, i }))
    .sort((p, q) => (p.e.zIndex ?? 0) - (q.e.zIndex ?? 0) || p.i - q.i)
    .map((p) => p.e);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      className="block w-full rounded-xl border border-white/10"
      style={{ height, background: CANVAS_BG }}
    >
      {openLines.map((l, i) => <Line key={l.id} el={l} gid={`${uid}-lo${i}`} />)}
      {boxes.map((el) => <ElementShape key={el.id} el={el} childCount={childCount.get(el.id) ?? 0} />)}
      {containerLines.map((l, i) => <Line key={l.id} el={l} gid={`${uid}-lc${i}`} />)}
      {liveEdges.map((edge, i) => (
        <Connector key={edge.id} edge={edge} from={byId.get(edge.fromNodeId)!} to={byId.get(edge.toNodeId)!} gid={`${uid}-e${i}`} />
      ))}
    </svg>
  );
}
