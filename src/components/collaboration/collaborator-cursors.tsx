'use client';

import { memo } from 'react';
import Image from 'next/image';
import { CollaboratorPresence } from '@/hooks/use-collaboration';

interface CollaboratorCursorsProps {
  collaborators: CollaboratorPresence[];
  canvasOffset: { x: number; y: number };
  zoom: number;
  currentBoardId?: string | null;
  /** CSS transition of the canvas camera transform, so cursors pan in step with it. */
  cameraTransition?: string;
}

// Cursor SVG component
function CursorIcon({ color }: { color: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-lg"
    >
      <path
        d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35z"
        fill={color}
        stroke="white"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// Single cursor component
const CollaboratorCursor = memo(function CollaboratorCursor({
  collaborator,
  zoom,
}: {
  collaborator: CollaboratorPresence;
  zoom: number;
}) {
  const { cursor, name, color, avatarUrl } = collaborator;

  // Show the cursor whenever the collaborator is live and has a known position.
  // We intentionally do NOT hide on a timestamp staleness — the cursor stays
  // parked at its last position and just updates when the peer moves it.
  if (!cursor) {
    return null;
  }

  // Positioned in WORLD coords inside the camera layer (see CollaboratorCursors).
  // Only the peer's own movement is eased here; the inner wrapper undoes the
  // layer's zoom so the cursor and label keep a constant on-screen size.
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        transform: `translate(${cursor.x}px, ${cursor.y}px)`,
        transition: 'transform 80ms linear',
        zIndex: 9999,
      }}
    >
      <div style={{ transform: `scale(${1 / zoom})`, transformOrigin: '0 0' }}>
      <CursorIcon color={color} />
      <div
        className="absolute left-5 top-5 flex w-max max-w-none items-center gap-1.5 whitespace-nowrap rounded-full pl-1 pr-3 py-1 text-xs font-medium text-white shadow-lg"
        style={{ backgroundColor: color }}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name}
            width={20}
            height={20}
            className="h-5 w-5 shrink-0 rounded-full ring-1 ring-white/30"
            unoptimized
          />
        ) : null}
        <span className="leading-none">{name}</span>
      </div>
      </div>
    </div>
  );
});

// Main cursors container
export const CollaboratorCursors = memo(function CollaboratorCursors({
  collaborators,
  canvasOffset,
  zoom,
  currentBoardId,
  cameraTransition,
}: CollaboratorCursorsProps) {
  const activeCursors = collaborators.filter((c) => {
    if (!c.cursor) return false;
    // Only show cursor if collaborator is in the same board context
    // (null/undefined both mean "main canvas" — treat as equal)
    const cursorBoard = c.cursor.boardId ?? null;
    const myBoard = currentBoardId ?? null;
    return cursorBoard === myBoard;
  });

  if (activeCursors.length === 0) {
    return null;
  }

  return (
    // Use fixed positioning so this overlay escapes the parent canvas container's
    // overflow-hidden, allowing cursor name labels to render at canvas edges
    // without being clipped. top-16 matches the canvas container's top offset.
    <div className="pointer-events-none fixed inset-0 top-16 overflow-visible" style={{ zIndex: 9998 }}>
      {/* Camera layer: the SAME transform + transition as the canvas content, so
          a camera move (live-follow, glide) carries every cursor with the canvas.
          Folding the camera into each cursor's own transform instead made the two
          update streams restart each other's easing — cursors jittered while following. */}
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          transition: cameraTransition ?? 'none',
        }}
      >
        {activeCursors.map((collaborator) => (
          <CollaboratorCursor
            key={collaborator.id}
            collaborator={collaborator}
            zoom={zoom}
          />
        ))}
      </div>
    </div>
  );
});
