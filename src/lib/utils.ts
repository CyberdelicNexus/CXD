import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts the center color from a gradient CSS string.
 * Handles radial-gradient, linear-gradient, and solid colors.
 * For radial: returns the inner stop. For linear: returns the first stop.
 */
export function extractCenterColor(gradient: string): string {
  if (!gradient) return '#1a0b2e';

  // Strip any /* ... */ marker comments (used for custom hue metadata)
  const cleaned = gradient.replace(/\/\*[^*]*\*\//g, '').trim();

  // Solid color
  if (cleaned.startsWith('#') || cleaned.startsWith('rgb')) {
    const m = cleaned.match(/^(#[a-fA-F0-9]{6,8}|rgba?\([^)]+\))/);
    return m ? m[1] : cleaned;
  }

  // Radial gradient — first color stop after the position descriptor
  const radialMatch = cleaned.match(/radial-gradient\([^,]+,\s*(#[a-fA-F0-9]{6,8}|rgba?\([^)]+\))/);
  if (radialMatch && radialMatch[1]) return radialMatch[1];

  // Linear gradient — first color stop, may follow an angle/direction or be the first arg
  const linearMatch = cleaned.match(/linear-gradient\(\s*(?:[^,]+,\s*)?(#[a-fA-F0-9]{6,8}|rgba?\([^)]+\))/);
  if (linearMatch && linearMatch[1]) return linearMatch[1];

  return '#1a0b2e';
}

/**
 * Creates a semi-transparent background color from a hex color
 * @param hexColor - Hex color string (e.g., "#1a0b2e")
 * @param opacity - Opacity value 0-1 (default 0.8)
 */
export function hexToRgba(hexColor: string, opacity: number = 0.8): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Handle 8-character hex (with alpha)
  const hexClean = hex.length === 8 ? hex.slice(0, 6) : hex;

  const r = parseInt(hexClean.slice(0, 2), 16);
  const g = parseInt(hexClean.slice(2, 4), 16);
  const b = parseInt(hexClean.slice(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(26, 11, 46, ${opacity})`; // Default fallback
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
