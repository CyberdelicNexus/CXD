'use client';

import { memo } from 'react';
import Image from 'next/image';
import { CollaboratorPresence, generateUserColor } from '@/hooks/use-collaboration';

interface CollaboratorAvatarsProps {
  collaborators: CollaboratorPresence[];
  maxVisible?: number;
  onClick?: () => void;
}

// Single avatar component
const Avatar = memo(function Avatar({
  collaborator,
  size = 32,
}: {
  collaborator: CollaboratorPresence;
  size?: number;
}) {
  const { name, email, avatarUrl, color } = collaborator;
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="relative flex items-center justify-center rounded-full border-2 border-black/50 font-medium text-white cursor-pointer"
      style={{
        width: size,
        height: size,
        backgroundColor: avatarUrl ? undefined : color,
        fontSize: size * 0.4,
      }}
      title={`${name} (${email})`}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full rounded-full object-cover"
          unoptimized
        />
      ) : (
        initials
      )}
      {/* Online indicator */}
      <div
        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-black bg-green-500"
        title="Online"
      />
    </div>
  );
});

// Overflow indicator
const OverflowIndicator = memo(function OverflowIndicator({
  count,
  size = 32,
}: {
  count: number;
  size?: number;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-full border-2 border-black/50 bg-white/10 text-xs font-medium text-white"
      style={{
        width: size,
        height: size,
      }}
    >
      +{count}
    </div>
  );
});

// Main avatars component
export const CollaboratorAvatars = memo(function CollaboratorAvatars({
  collaborators,
  maxVisible = 4,
  onClick,
}: CollaboratorAvatarsProps) {
  const visibleCollaborators = collaborators.slice(0, maxVisible);
  const overflowCount = Math.max(0, collaborators.length - maxVisible);

  if (collaborators.length === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center -space-x-2 transition-opacity hover:opacity-80"
      title={`${collaborators.length} collaborator${collaborators.length === 1 ? '' : 's'} online`}
    >
      {visibleCollaborators.map((collaborator) => (
        <Avatar key={collaborator.id} collaborator={collaborator} />
      ))}
      {overflowCount > 0 && <OverflowIndicator count={overflowCount} />}
    </button>
  );
});

// Connection status indicator
export const ConnectionStatus = memo(function ConnectionStatus({
  isConnected,
}: {
  isConnected: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div
        className={`h-2 w-2 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
        }`}
      />
      <span className="text-white/60">
        {isConnected ? 'Connected' : 'Connecting...'}
      </span>
    </div>
  );
});
