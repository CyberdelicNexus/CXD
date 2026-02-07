import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, Grid3X3, Undo2, Redo2, Magnet, AlignVerticalJustifyCenter } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavigationToolkitProps {
  canvasZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitAll: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  snapToGrid?: boolean;
  onToggleSnapToGrid?: () => void;
  showAlignmentGuides?: boolean;
  onToggleAlignmentGuides?: () => void;
}

export function NavigationToolkit({
  canvasZoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  snapToGrid,
  onToggleSnapToGrid,
  showAlignmentGuides,
  onToggleAlignmentGuides,
}: NavigationToolkitProps) {
  return (
    <div className="absolute left-6 flex items-center gap-2 z-10 bottom-[56px] flex-col h-fit top-[248.8px]">
      {/* Snap & Alignment Toggles */}
      <div className="flex flex-col gap-1 p-1 rounded-lg bg-card/80 backdrop-blur border border-border">
        {onToggleSnapToGrid && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSnapToGrid}
            className={cn(
              "transition-colors",
              snapToGrid && "bg-primary/20 text-primary ring-1 ring-primary/50"
            )}
            title={snapToGrid ? "Snap to Grid (On)" : "Snap to Grid (Off)"}
          >
            <Magnet className="w-4 h-4" />
          </Button>
        )}
        {onToggleAlignmentGuides && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleAlignmentGuides}
            className={cn(
              "transition-colors",
              showAlignmentGuides && "bg-primary/20 text-primary ring-1 ring-primary/50"
            )}
            title={showAlignmentGuides ? "Alignment Guides (On)" : "Alignment Guides (Off)"}
          >
            <AlignVerticalJustifyCenter className="w-4 h-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-1 p-1 rounded-lg bg-card/80 backdrop-blur border border-border flex-col w-[42.599999999999994px]">
        <Button variant="ghost" size="icon" onClick={onZoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="px-2 text-sm font-mono min-w-[60px] text-center">
          {Math.round(canvasZoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" onClick={onZoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onResetView}
        className="bg-card/80 backdrop-blur border border-border"
        title="Reset View"
      >
        <Maximize2 className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onFitAll}
        className="bg-card/80 backdrop-blur border border-border"
        title="Fit All"
      >
        <Grid3X3 className="w-4 h-4" />
      </Button>

      {onUndo && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo}
          className="backdrop-blur border border-border disabled:opacity-50 bg-card opacity-80"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </Button>
      )}
      {onRedo && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={!canRedo}
          className="bg-card/80 backdrop-blur border border-border disabled:opacity-50"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
