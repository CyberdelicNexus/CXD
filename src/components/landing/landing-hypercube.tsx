'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Vec3 = [number, number, number];

interface Dimension {
  id: string;
  name: string;
  color: string;
  faceIndex: number; // -1 = core (inner cube), 0..5 = outer cube faces
  targetRx: number | null;
  targetRy: number | null;
  description: string;
}

/**
 * Face index convention (matches FACES array below):
 *   0 = +X (right)   1 = -X (left)
 *   2 = +Y (bottom in SVG, since SVG y grows downward)
 *   3 = -Y (top in SVG)
 *   4 = +Z (away from viewer)   5 = -Z (toward viewer)
 *
 * Perspective projection uses `p = persp / (persp + z)`, which means
 * positive z goes INTO the screen and negative z comes TOWARD the viewer.
 * So the "front" face is the one whose rotated normal has the SMALLEST z.
 *
 * Target rotations are chosen so that clicking a button rotates that face
 * normal to (0, 0, -1), i.e. fully forward.
 */
const DIMENSIONS: Dimension[] = [
  {
    id: 'core',
    name: 'Core',
    color: '#FFFFFF',
    faceIndex: -1,
    targetRx: null, // freeze current orientation
    targetRy: null,
    description: 'The guiding intent at the center. The core message every dimension of the experience is built around.',
  },
  {
    id: 'reality',
    name: 'Reality Planes',
    color: '#8B5CF6',
    faceIndex: 5,
    targetRx: 0,
    targetRy: 0,
    description: 'The world the experience inhabits: physical, virtual, augmented, mixed, generative, biological, or cognitive.',
  },
  {
    id: 'sensory',
    name: 'Sensory Domains',
    color: '#EC4899',
    faceIndex: 1,
    targetRx: 0,
    targetRy: Math.PI / 2,
    description: 'The perceptual channels the experience is received through: visual, auditory, tactile, olfactory, gustatory.',
  },
  {
    id: 'presence',
    name: 'Presence Types',
    color: '#06B6D4',
    faceIndex: 2,
    targetRx: -Math.PI / 2,
    targetRy: 0,
    description: 'What the experience cultivates: mental, emotional, social, embodied, environmental, or active presence.',
  },
  {
    id: 'state',
    name: 'State Mapping',
    color: '#F59E0B',
    faceIndex: 0,
    targetRx: 0,
    targetRy: -Math.PI / 2,
    description: 'The transient consciousness shifts the experience facilitates: cognitive, emotional, somatic, relational.',
  },
  {
    id: 'trait',
    name: 'Trait Mapping',
    color: '#10B981',
    faceIndex: 3,
    targetRx: Math.PI / 2,
    targetRy: 0,
    description: 'The lasting changes that endure after: cognitive flexibility, emotional regulation, embodiment, empathy.',
  },
  {
    id: 'meaning',
    name: 'Meaning Architecture',
    color: '#3B82F6',
    faceIndex: 4,
    targetRx: 0,
    targetRy: Math.PI,
    description: 'The soul of the design: the world, story, and magic the experience lives inside of.',
  },
];

const CORE_IDX = 0;
const CORE_COLOR = DIMENSIONS[CORE_IDX].color;

const STRUT_COLOR = 'rgba(255, 255, 255, 0.22)';
const OUTER_COLOR = 'rgba(255, 255, 255, 0.55)';
const INNER_WHITE = '#FFFFFF';

const CUBE_VERTS: Vec3[] = [
  [-1, -1, -1], [ 1, -1, -1], [-1,  1, -1], [ 1,  1, -1],
  [-1, -1,  1], [ 1, -1,  1], [-1,  1,  1], [ 1,  1,  1],
];

const CUBE_EDGES: Array<[number, number]> = [
  [0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3],
  [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7],
];

const FACES: Array<{ normal: Vec3; verts: [number, number, number, number] }> = [
  { normal: [ 1, 0, 0], verts: [1, 3, 7, 5] },  // +X
  { normal: [-1, 0, 0], verts: [0, 2, 6, 4] },  // -X
  { normal: [ 0, 1, 0], verts: [2, 3, 7, 6] },  // +Y
  { normal: [ 0,-1, 0], verts: [0, 1, 5, 4] },  // -Y
  { normal: [ 0, 0, 1], verts: [4, 5, 7, 6] },  // +Z
  { normal: [ 0, 0,-1], verts: [0, 1, 3, 2] },  // -Z
];

const DEFAULT_RX = -0.42;

function rotate([x, y, z]: Vec3, rx: number, ry: number): Vec3 {
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const x1 = x * cy - z * sy;
  const z1 = x * sy + z * cy;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const y1 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  return [x1, y1, z2];
}

function project([x, y, z]: Vec3, perspective: number, scale: number) {
  const p = perspective / (perspective + z);
  return { x: x * p * scale, y: y * p * scale, z };
}

function normalizeToward(current: number, target: number): number {
  let c = current;
  while (c - target > Math.PI) c -= 2 * Math.PI;
  while (c - target < -Math.PI) c += 2 * Math.PI;
  return c;
}

type Mode = 'auto' | 'hoverPause' | 'manual';

export function LandingHypercube({ className }: { className?: string }) {
  const [rx, setRx] = useState(DEFAULT_RX);
  const [ry, setRy] = useState(0);
  const [mode, setMode] = useState<Mode>('auto');
  const [activeIdx, setActiveIdx] = useState(1); // Reality Planes initially
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const targetRxRef = useRef(DEFAULT_RX);
  const targetRyRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  useEffect(() => {
    const tick = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      if (mode === 'auto') {
        setRy((prev) => prev + dt * 0.28);
      } else if (mode === 'manual') {
        const k = Math.min(1, dt * 5);
        setRx((prev) => prev + (targetRxRef.current - prev) * k);
        setRy((prev) => prev + (targetRyRef.current - prev) * k);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = 0;
    };
  }, [mode]);

  // Infer which face is currently most forward (used when nothing is selected).
  const frontFaceIndex = useMemo(() => {
    let idx = 0;
    let minZ = Infinity;
    for (let i = 0; i < FACES.length; i++) {
      const n = rotate(FACES[i].normal, rx, ry);
      if (n[2] < minZ) {
        minZ = n[2];
        idx = i;
      }
    }
    return idx;
  }, [rx, ry]);

  const inferredDimIdx = useMemo(
    () => DIMENSIONS.findIndex((d) => d.faceIndex === frontFaceIndex),
    [frontFaceIndex],
  );

  useEffect(() => {
    if (selectedIdx !== null) {
      if (activeIdx !== selectedIdx) setActiveIdx(selectedIdx);
      return;
    }
    if (inferredDimIdx >= 0 && inferredDimIdx !== activeIdx) {
      setActiveIdx(inferredDimIdx);
    }
  }, [selectedIdx, inferredDimIdx, activeIdx]);

  const handleSelect = useCallback(
    (i: number) => {
      const dim = DIMENSIONS[i];
      if (dim.targetRx === null || dim.targetRy === null) {
        // Core: freeze current orientation, no animation.
        targetRxRef.current = rx;
        targetRyRef.current = ry;
      } else {
        targetRxRef.current = dim.targetRx;
        targetRyRef.current = dim.targetRy;
        setRy((prev) => normalizeToward(prev, dim.targetRy!));
        setRx((prev) => normalizeToward(prev, dim.targetRx!));
      }
      setSelectedIdx(i);
      setMode('manual');
    },
    [rx, ry],
  );

  const handleMouseEnter = useCallback(() => {
    setMode((m) => (m === 'auto' ? 'hoverPause' : m));
  }, []);
  const handleMouseLeave = useCallback(() => {
    setMode((m) => (m === 'hoverPause' ? 'auto' : m));
  }, []);

  const PERSP = 4;
  // SCALE = 75 keeps the cube's max projected magnitude (~141) well inside
  // the viewBox half-width of 160 at any rotation, so auto-spin doesn't clip.
  const SCALE = 75;

  const outer = CUBE_VERTS.map((v) => project(rotate(v, rx, ry), PERSP, SCALE));
  const inner = CUBE_VERTS.map((v) =>
    project(rotate([v[0] * 0.45, v[1] * 0.45, v[2] * 0.45], rx, ry), PERSP, SCALE),
  );

  const active = DIMENSIONS[activeIdx];
  const isCore = active.faceIndex === -1;

  const activeFacePoints = !isCore
    ? FACES[active.faceIndex].verts
        .map((i) => `${outer[i].x.toFixed(2)},${outer[i].y.toFixed(2)}`)
        .join(' ')
    : '';

  // Build the inner cube's 6 faces for Core highlight
  const innerFaceFills = isCore
    ? FACES.map((f) =>
        f.verts.map((i) => `${inner[i].x.toFixed(2)},${inner[i].y.toFixed(2)}`).join(' '),
      )
    : [];

  const innerEdgeColor = isCore ? CORE_COLOR : INNER_WHITE;
  const innerVertexColor = isCore ? CORE_COLOR : INNER_WHITE;

  return (
    <div className={className}>
      {/* Dimension buttons */}
      <div className="flex flex-wrap justify-center gap-2 mb-5">
        {DIMENSIONS.map((dim, i) => {
          const isActive = activeIdx === i;
          const isCoreBtn = dim.faceIndex === -1;
          return (
            <button
              key={dim.id}
              type="button"
              onClick={() => handleSelect(i)}
              className={
                'px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-medium border flex items-center gap-1.5 transition-colors ' +
                (isCoreBtn ? 'border-dashed' : '')
              }
              style={{
                borderColor: isActive ? dim.color : 'rgba(255,255,255,0.14)',
                background: isActive ? `${dim.color}22` : 'rgba(255,255,255,0.04)',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.72)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: dim.color }}
              />
              {dim.name}
            </button>
          );
        })}
      </div>

      {/* Hypercube */}
      <div
        className="relative w-full aspect-square max-w-[380px] mx-auto"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          viewBox="-160 -160 320 320"
          className="w-full h-full select-none"
          aria-label="Rotating hypercube explaining six experience design dimensions"
        >
          <defs>
            <radialGradient id="lh-core-glow" cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor={isCore ? CORE_COLOR : '#ffffff'}
                stopOpacity={isCore ? '0.55' : '0.25'}
              />
              <stop
                offset="60%"
                stopColor={isCore ? CORE_COLOR : '#a78bfa'}
                stopOpacity={isCore ? '0.12' : '0.06'}
              />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Soft core glow */}
          <circle
            cx="0"
            cy="0"
            r={isCore ? 95 : 70}
            fill="url(#lh-core-glow)"
            style={{ transition: 'r 300ms ease' }}
          />

          {/* Struts */}
          {outer.map((o, i) => (
            <line
              key={`strut-${i}`}
              x1={o.x}
              y1={o.y}
              x2={inner[i].x}
              y2={inner[i].y}
              stroke={STRUT_COLOR}
              strokeWidth={0.8}
            />
          ))}

          {/* Active outer face highlight */}
          {!isCore && (
            <polygon
              points={activeFacePoints}
              fill={active.color}
              fillOpacity={0.18}
              stroke={active.color}
              strokeOpacity={0.95}
              strokeWidth={1.6}
              style={{ transition: 'fill 300ms ease, stroke 300ms ease' }}
            />
          )}

          {/* Core highlight: fill all 6 inner cube faces with orange */}
          {isCore &&
            innerFaceFills.map((pts, i) => (
              <polygon
                key={`inner-face-${i}`}
                points={pts}
                fill={CORE_COLOR}
                fillOpacity={0.2}
              />
            ))}

          {/* Outer cube edges */}
          {CUBE_EDGES.map(([a, b], i) => (
            <line
              key={`outer-${i}`}
              x1={outer[a].x}
              y1={outer[a].y}
              x2={outer[b].x}
              y2={outer[b].y}
              stroke={OUTER_COLOR}
              strokeWidth={1.1}
            />
          ))}

          {/* Inner cube edges */}
          {CUBE_EDGES.map(([a, b], i) => (
            <line
              key={`inner-${i}`}
              x1={inner[a].x}
              y1={inner[a].y}
              x2={inner[b].x}
              y2={inner[b].y}
              stroke={innerEdgeColor}
              strokeOpacity={isCore ? 1 : 0.92}
              strokeWidth={isCore ? 1.6 : 1.3}
            />
          ))}

          {/* Outer vertex dots */}
          {outer.map((o, i) => (
            <circle
              key={`vo-${i}`}
              cx={o.x}
              cy={o.y}
              r={1.8}
              fill="rgba(255,255,255,0.7)"
            />
          ))}

          {/* Inner vertex dots */}
          {inner.map((o, i) => (
            <circle
              key={`vi-${i}`}
              cx={o.x}
              cy={o.y}
              r={isCore ? 2.1 : 1.6}
              fill={innerVertexColor}
            />
          ))}
        </svg>
      </div>

      {/* Info card */}
      <div className="mt-5 mx-auto max-w-[400px] min-h-[96px] rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm px-5 py-4 text-center">
        <div
          key={active.id}
          className="text-base md:text-lg font-semibold animate-[lh-fade_350ms_ease]"
          style={{ color: active.color }}
        >
          {active.name}
        </div>
        <div className="text-sm text-white/65 leading-relaxed mt-1.5">
          {active.description}
        </div>
      </div>

      <style jsx>{`
        @keyframes lh-fade {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
