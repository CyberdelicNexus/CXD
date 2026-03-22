import type { CanvasElement } from '@/types/canvas-elements';
import type { ElementStyle } from '@/types/canvas-elements';

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  elements: CanvasElement[];
}

const containerStyle: ElementStyle = {
  borderColor: 'rgba(255,255,255,0.15)',
  borderWidth: 1,
  borderStyle: 'dashed',
  bgColor: 'rgba(255,255,255,0.03)',
};

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'user-journey',
    name: 'User Journey',
    description: 'Map the end-to-end experience across stages',
    emoji: '🗺️',
    elements: [
      { id: 'uj-1', type: 'container', x: 100,  y: 200, width: 350, height: 500, zIndex: 0, label: 'Awareness',     style: containerStyle },
      { id: 'uj-2', type: 'container', x: 500,  y: 200, width: 350, height: 500, zIndex: 0, label: 'Consideration', style: containerStyle },
      { id: 'uj-3', type: 'container', x: 900,  y: 200, width: 350, height: 500, zIndex: 0, label: 'Engagement',    style: containerStyle },
      { id: 'uj-4', type: 'container', x: 1300, y: 200, width: 350, height: 500, zIndex: 0, label: 'Experience',    style: containerStyle },
      { id: 'uj-5', type: 'container', x: 1700, y: 200, width: 350, height: 500, zIndex: 0, label: 'Reflection',    style: containerStyle },
    ] as CanvasElement[],
  },
  {
    id: 'service-blueprint',
    name: 'Service Blueprint',
    description: 'Visualize frontstage and backstage service layers',
    emoji: '🏗️',
    elements: [
      { id: 'sb-1', type: 'container', x: 100, y: 150,  width: 1800, height: 200, zIndex: 0, label: 'Customer Actions',  style: containerStyle },
      { id: 'sb-2', type: 'container', x: 100, y: 400,  width: 1800, height: 200, zIndex: 0, label: 'Frontstage',        style: containerStyle },
      { id: 'sb-3', type: 'container', x: 100, y: 650,  width: 1800, height: 200, zIndex: 0, label: 'Backstage',         style: containerStyle },
      { id: 'sb-4', type: 'container', x: 100, y: 900,  width: 1800, height: 200, zIndex: 0, label: 'Support Processes', style: containerStyle },
    ] as CanvasElement[],
  },
  {
    id: 'workshop',
    name: 'Workshop Canvas',
    description: 'Structure a collaborative workshop with activities and outputs',
    emoji: '🧩',
    elements: [
      { id: 'ws-1', type: 'container', x: 100,  y: 150, width: 550, height: 300, zIndex: 0, label: 'Objective',            style: containerStyle },
      { id: 'ws-2', type: 'container', x: 700,  y: 150, width: 550, height: 300, zIndex: 0, label: 'Participants',         style: containerStyle },
      { id: 'ws-3', type: 'container', x: 1300, y: 150, width: 550, height: 300, zIndex: 0, label: 'Outputs & Next Steps', style: containerStyle },
      { id: 'ws-4', type: 'container', x: 100,  y: 500, width: 550, height: 350, zIndex: 0, label: 'Activity 1',          style: containerStyle },
      { id: 'ws-5', type: 'container', x: 700,  y: 500, width: 550, height: 350, zIndex: 0, label: 'Activity 2',          style: containerStyle },
      { id: 'ws-6', type: 'container', x: 1300, y: 500, width: 550, height: 350, zIndex: 0, label: 'Activity 3',          style: containerStyle },
    ] as CanvasElement[],
  },
];
