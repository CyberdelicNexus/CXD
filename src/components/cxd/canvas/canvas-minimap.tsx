'use client';

import { CXD_SECTIONS } from '@/types/cxd-schema';

interface CanvasMinimapProps {
  sections: { id: string; x: number; y: number }[];
  canvasPosition: { x: number; y: number };
  canvasZoom: number;
  onNavigate: (position: { x: number; y: number }) => void;
}

export function CanvasMinimap({ sections, canvasPosition, canvasZoom, onNavigate }: CanvasMinimapProps) {
  const minimapWidth = 160;
  const minimapHeight = 100;
  const canvasWidth = 1600;
  const canvasHeight = 800;
  
  const scaleX = minimapWidth / canvasWidth;
  const scaleY = minimapHeight / canvasHeight;

  const viewportWidth = (typeof window !== 'undefined' ? window.innerWidth : 1200) / canvasZoom;
  const viewportHeight = (typeof window !== 'undefined' ? window.innerHeight - 64 : 700) / canvasZoom;

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / scaleX;
    const clickY = (e.clientY - rect.top) / scaleY;
    
    onNavigate({
      x: -(clickX - viewportWidth / 2),
      y: -(clickY - viewportHeight / 2),
    });
  };

  return (
    <div className="absolute bottom-6 right-6 bg-card/80 backdrop-blur border border-border rounded-lg p-2">
      <div 
        className="relative cursor-pointer"
        style={{ width: minimapWidth, height: minimapHeight }}
        onClick={handleMinimapClick}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-background/50 rounded" />
        
        {/* Section markers */}
        {sections.map((section) => {
          const sectionData = CXD_SECTIONS.find(s => s.id === section.id);
          return (
            <div
              key={section.id}
              className="absolute w-6 h-4 bg-primary/40 rounded-sm"
              style={{
                left: section.x * scaleX,
                top: section.y * scaleY,
              }}
              title={sectionData?.label}
            />
          );
        })}
        
        {/* Viewport indicator */}
        <div
          className="absolute border-2 border-primary rounded-sm pointer-events-none"
          style={{
            left: -canvasPosition.x * scaleX,
            top: -canvasPosition.y * scaleY,
            width: viewportWidth * scaleX,
            height: viewportHeight * scaleY,
          }}
        />
      </div>
    </div>
  );
}
