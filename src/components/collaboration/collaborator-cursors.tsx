'use client';

import { memo, useMemo } from 'react';
import { CollaboratorPresence } from '@/hooks/use-collaboration';

interface CollaboratorCursorsProps {
  collaborators: CollaboratorPresence[];
  canvasOffset: { x: number; y: number };
  zoom: number;
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
  canvasOffset,
  zoom,
}: {
  collaborator: CollaboratorPresence;
  canvasOffset: { x: number; y: number };
  zoom: number;
}) {
  const { cursor, name, color, avatarUrl } = collaborator;

  // Don't render if no cursor or cursor is stale (> 5 seconds)
  if (!cursor || Date.now() - cursor.timestamp > 5000) {
    return null;
  }

  // Calculate screen position (world coords * zoom + canvas offset)
  const screenX = cursor.x * zoom + canvasOffset.x;
  const screenY = cursor.y * zoom + canvasOffset.y;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        transform: `translate(${screenX}px, ${screenY}px)`,
        transition: 'transform 100ms linear',
        zIndex: 9999,
      }}
    >
      <CursorIcon color={color} />
      <div
        className="absolute left-5 top-5 flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium text-white shadow-lg"
        style={{ backgroundColor: color }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-4 w-4 rounded-full"
          />
        ) : null}
        <span>{name}</span>
      </div>
    </div>
  );
});

// Main cursors container
export const CollaboratorCursors = memo(function CollaboratorCursors({
  collaborators,
  canvasOffset,
  zoom,
}: CollaboratorCursorsProps) {
  // Filter collaborators with active cursors
  const activeCursors = useMemo(() => {
    return collaborators.filter(
      (c) => c.cursor && Date.now() - c.cursor.timestamp < 5000
    );
  }, [collaborators]);

  if (activeCursors.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {activeCursors.map((collaborator) => (
        <CollaboratorCursor
          key={collaborator.id}
          collaborator={collaborator}
          canvasOffset={canvasOffset}
          zoom={zoom}
        />
      ))}
    </div>
  );
});
