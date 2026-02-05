import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts the center color from a radial gradient CSS string.
 * For gradients like "radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)"
 * Returns the first color (center color).
 * For solid colors like "#000000", returns the color as-is.
 */
export function extractCenterColor(gradient: string): string {
  if (!gradient) return '#1a0b2e'; // Default fallback

  // If it's a solid color (starts with # or rgb)
  if (gradient.startsWith('#') || gradient.startsWith('rgb')) {
    return gradient;
  }

  // Extract color from radial-gradient
  const match = gradient.match(/radial-gradient\([^,]+,\s*(#[a-fA-F0-9]{6,8}|rgba?\([^)]+\))/);
  if (match && match[1]) {
    return match[1];
  }

  return '#1a0b2e'; // Default fallback
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
