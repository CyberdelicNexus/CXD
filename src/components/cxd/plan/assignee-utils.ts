'use client';

export const parseAssignees = (raw?: string): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
};

export const serializeAssignees = (assignees: string[]): string | undefined => {
  const clean = assignees.map(s => s.trim()).filter(Boolean);
  if (clean.length === 0) return undefined;
  return clean.join(', ');
};

