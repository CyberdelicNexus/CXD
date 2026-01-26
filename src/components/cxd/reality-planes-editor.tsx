"use client";

import { useState, useCallback } from "react";
import { useCXDStore } from "@/store/cxd-store";
import { REALITY_PLANES, RealityPlaneCode } from "@/types/cxd-schema";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface RealityPlanesEditorProps {
  className?: string;
  compact?: boolean;
}

export function RealityPlanesEditor({
  className,
  compact = false,
}: RealityPlanesEditorProps) {
  const {
    getRealityPlanesV2,
    toggleRealityPlane,
    updateRealityPlaneInterface,
    reorderRealityPlanes,
  } = useCXDStore();

  const realityPlanes = getRealityPlanesV2();
  const [draggedItem, setDraggedItem] = useState<RealityPlaneCode | null>(null);
  const [dragOverItem, setDragOverItem] = useState<RealityPlaneCode | null>(
    null,
  );

  // Sort by priority
  const sortedPlanes = [...realityPlanes].sort(
    (a, b) => a.priority - b.priority,
  );

  // Get plane label from the REALITY_PLANES constant
  const getPlaneLabel = (code: RealityPlaneCode) => {
    const plane = REALITY_PLANES.find((p) => p.code === code);
    return plane?.label || code;
  };

  const getPlaneDescription = (code: RealityPlaneCode) => {
    const plane = REALITY_PLANES.find((p) => p.code === code);
    return plane?.description || "";
  };

  // Drag and drop handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, code: RealityPlaneCode) => {
      setDraggedItem(code);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", code);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, code: RealityPlaneCode) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggedItem && draggedItem !== code) {
        setDragOverItem(code);
      }
    },
    [draggedItem],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverItem(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetCode: RealityPlaneCode) => {
      e.preventDefault();
      if (draggedItem && draggedItem !== targetCode) {
        // Create new order
        const currentOrder = sortedPlanes.map((p) => p.code);
        const draggedIndex = currentOrder.indexOf(draggedItem);
        const targetIndex = currentOrder.indexOf(targetCode);

        // Remove dragged item from current position
        currentOrder.splice(draggedIndex, 1);
        // Insert at new position
        currentOrder.splice(targetIndex, 0, draggedItem);

        reorderRealityPlanes(currentOrder);
      }
      setDraggedItem(null);
      setDragOverItem(null);
    },
    [draggedItem, sortedPlanes, reorderRealityPlanes],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverItem(null);
  }, []);

  return (
    <div className={cn("space-y-3 w-full", className)}>
      {!compact && (
        <p className="text-xs text-muted-foreground w-full">
          Toggle planes on/off and drag to reorder priority. Add
          interface/modality details for each enabled plane.
        </p>
      )}
      <div className="space-y-2 w-full">
        {sortedPlanes.map((plane, index) => (
          <div
            key={plane.code}
            draggable
            onDragStart={(e) => handleDragStart(e, plane.code)}
            onDragOver={(e) => handleDragOver(e, plane.code)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, plane.code)}
            onDragEnd={handleDragEnd}
            className={cn(
              "group flex flex-col gap-2 p-3 rounded-lg border transition-all",
              "bg-card/50 hover:bg-card/80",
              draggedItem === plane.code && "opacity-50 scale-95",
              dragOverItem === plane.code &&
                "border-primary ring-2 ring-primary/20",
              plane.enabled
                ? "border-primary/30 bg-primary/5"
                : "border-border/50 w-full",
            )}
          >
            <div className="flex items-center gap-3 w-full">
              {/* Drag handle */}
              <div className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground">
                <GripVertical className="w-4 h-4" />
              </div>

              {/* Priority badge */}
              <div
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium",
                  plane.enabled
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {index + 1}
              </div>

              {/* Plane code and label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      plane.enabled
                        ? "text-primary"
                        : "text-muted-foreground text-[14.75px]",
                    )}
                  >
                    {plane.code}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      plane.enabled
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {getPlaneLabel(plane.code)}
                  </span>
                </div>
                {!compact && (
                  <p className="text-xs text-muted-foreground truncate">
                    {getPlaneDescription(plane.code)}
                  </p>
                )}
              </div>

              {/* Toggle switch */}
              <Switch
                checked={plane.enabled}
                onCheckedChange={() => toggleRealityPlane(plane.code)}
                aria-label={`Toggle ${getPlaneLabel(plane.code)}`}
              />
            </div>

            {/* Interface/Modality text field - only visible when enabled */}
            {plane.enabled && (
              <div className="pl-7">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Interface / Modality
                </Label>
                <Textarea
                  value={plane.interfaceModality}
                  onChange={(e) =>
                    updateRealityPlaneInterface(plane.code, e.target.value)
                  }
                  placeholder={`How will ${plane.code} be delivered?`}
                  className="min-h-[60px] text-sm bg-background/50 resize-none"
                  rows={2}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Summary of enabled planes */}
      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          Active planes:{" "}
          {sortedPlanes
            .filter((p) => p.enabled)
            .map((p) => p.code)
            .join(", ") || "None"}
        </p>
      </div>
    </div>
  );
}
