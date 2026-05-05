/**
 * Shared display utilities for consistent formatting across the app
 */

/**
 * Canonical face display names
 * Used for converting camelCase face keys to proper display text
 */
export const FACE_DISPLAY_NAMES: Record<string, string> = {
  realityPlanes: 'Reality Planes',
  sensoryDomains: 'Sensory Domains',
  presence: 'Presence Types',
  stateMapping: 'State Mapping',
  traitMapping: 'Trait Mapping',
  contextAndMeaning: 'Meaning Architecture',
  intentionCore: 'Core',
};

/**
 * Get the display name for a face key
 * @param faceKey - The camelCase face key (e.g., "realityPlanes")
 * @returns The properly formatted display name (e.g., "Reality Planes")
 */
export function getFaceDisplayName(faceKey: string): string {
  return FACE_DISPLAY_NAMES[faceKey] || faceKey;
}

/**
 * Clamp a value to the range [0, 1]
 * Logs a warning in development if value is out of range
 * @param value - The value to clamp
 * @param context - Optional context for the warning message
 * @returns The clamped value
 */
export function clampToUnit(value: number, context?: string): number {
  if (process.env.NODE_ENV === 'development' && (value < 0 || value > 1)) {
    console.warn(
      `[Display Utils] Value out of range [0, 1]: ${value}${context ? ` (${context})` : ''}`
    );
  }
  return Math.max(0, Math.min(value, 1));
}

/**
 * Format a completion value as a percentage
 * @param completion - The completion value (0-1)
 * @returns Formatted percentage string (e.g., "72%")
 */
export function formatCompletion(completion: number): string {
  const clamped = clampToUnit(completion, 'formatCompletion');
  return `${Math.round(clamped * 100)}%`;
}
