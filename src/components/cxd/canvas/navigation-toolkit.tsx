import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, Grid3X3, Undo2, Redo2, AlignVerticalJustifyCenter, Grip } from "lucide-react";
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
  showAlignmentGuides?: boolean;
  onToggleAlignmentGuides?: () => void;
  gridVisible?: boolean;
  onToggleGrid?: () => void;
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
  showAlignmentGuides,
  onToggleAlignmentGuides,
  gridVisible,
  onToggleGrid,
}: NavigationToolkitProps) {
  return (
    // Vertically centered on the page regardless of viewport height (top-1/2 +
    // translate), pinned to the left edge — no hardcoded top/bottom offsets.
    <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10 flex-col h-fit">
      {/* Grid + Alignment Toggles */}
      <div className="flex flex-col gap-1 p-1 rounded-lg bg-card/80 backdrop-blur border border-border">
        {onToggleGrid && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleGrid}
            className={cn(
              "transition-colors",
              gridVisible && "bg-primary/20 text-primary ring-1 ring-primary/50"
            )}
            title={gridVisible ? "Dot Grid (On)" : "Dot Grid (Off)"}
          >
            <Grip className="w-4 h-4" />
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
