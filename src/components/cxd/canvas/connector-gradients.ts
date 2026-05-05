// src/components/cxd/canvas/connector-gradients.ts

export type GradientName = 'violet' | 'ocean' | 'emerald' | 'sunset' | 'rose' | 'glacier';

export interface GradientConfig {
  name: GradientName;
  dark: string;
  mid: string;
  light: string;
}

export const GRADIENTS: Record<GradientName, GradientConfig> = {
  violet:  { name: 'violet',  dark: '#3B0764', mid: '#7C3AED', light: '#C4B5FD' },
  ocean:   { name: 'ocean',   dark: '#0C1B5E', mid: '#2563EB', light: '#67E8F9' },
  emerald: { name: 'emerald', dark: '#022C22', mid: '#059669', light: '#6EE7B7' },
  sunset:  { name: 'sunset',  dark: '#431407', mid: '#EA580C', light: '#FDE68A' },
  rose:    { name: 'rose',    dark: '#500724', mid: '#DB2777', light: '#FBCFE8' },
  glacier: { name: 'glacier', dark: '#0F172A', mid: '#475569', light: '#E2E8F0' },
};

export const GRADIENT_ORDER: GradientName[] = [
  'violet', 'ocean', 'emerald', 'sunset', 'rose', 'glacier',
];

export function getGradient(name: GradientName | undefined): GradientConfig {
  return GRADIENTS[name ?? 'violet'];
}
