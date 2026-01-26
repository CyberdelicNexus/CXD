"use client";

import { useState, useRef, useEffect } from "react";
import { useCXDStore } from "@/store/cxd-store";
import {
  ENGAGEMENT_LEVELS,
  EngagementLevelCode,
  EngagementDistribution,
  DEFAULT_ENGAGEMENT_DISTRIBUTION,
  STAGE_PRESENCE_TYPES,
  StagePresenceTypeCode,
  StagePresenceTypes,
  DEFAULT_STAGE_PRESENCE_TYPES,
} from "@/types/cxd-schema";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  ChevronUp,
  ChevronDown,
  Activity,
  AlertTriangle,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Brain,
  Heart,
  Users,
  Footprints,
  Leaf,
  Zap,
} from "lucide-react";

// Icon map for presence types
const PRESENCE_ICONS: Record<StagePresenceTypeCode, React.ReactNode> = {
  mental: <Brain className="w-4 h-4" />,
  emotional: <Heart className="w-4 h-4" />,
  social: <Users className="w-4 h-4" />,
  embodied: <Footprints className="w-4 h-4" />,
  environmental: <Leaf className="w-4 h-4" />,
  active: <Zap className="w-4 h-4" />,
};

export function ExperienceFlowDrawer() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );
  const [selectedPresenceType, setSelectedPresenceType] =
    useState<StagePresenceTypeCode>("mental");
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const {
    getCurrentProject,
    getExperienceFlowStages,
    addExperienceFlowStage,
    removeExperienceFlowStage,
    renameExperienceFlowStage,
    moveExperienceFlowStage,
    reorderExperienceFlowStage,
    updateExperienceFlowStageDistribution,
    updateExperienceFlowStageNarrative,
    updateExperienceFlowStagePresence,
    updateExperienceFlowStageTime,
  } = useCXDStore();

  const project = getCurrentProject();
  const stages = getExperienceFlowStages();

  // Set initial active stage
  useEffect(() => {
    if (stages.length > 0 && !activeStageId) {
      setActiveStageId(stages[0].id);
    }
  }, [stages, activeStageId]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingStageId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingStageId]);

  if (!project) return null;

  const currentStage = stages.find((s) => s.id === activeStageId);
  const currentStageIndex = stages.findIndex((s) => s.id === activeStageId);
  const distribution =
    currentStage?.engagementDistribution || DEFAULT_ENGAGEMENT_DISTRIBUTION;
  const presenceTypes =
    currentStage?.presenceTypes || DEFAULT_STAGE_PRESENCE_TYPES;

  const total =
    distribution.observer +
    distribution.engager +
    distribution.coCreator +
    distribution.architect;

  const handleDistributionChange = (
    level: EngagementLevelCode,
    value: number,
  ) => {
    if (!activeStageId) return;
    const newDistribution: EngagementDistribution = {
      ...distribution,
      [level]: value,
    };
    updateExperienceFlowStageDistribution(activeStageId, newDistribution);
  };

  const handleNormalize = () => {
    if (!activeStageId) return;
    if (total === 0) {
      updateExperienceFlowStageDistribution(activeStageId, {
        observer: 0,
        engager: 100,
        coCreator: 0,
        architect: 0,
      });
      return;
    }
    const scale = 100 / total;
    const normalized: EngagementDistribution = {
      observer: Math.round(distribution.observer * scale),
      engager: Math.round(distribution.engager * scale),
      coCreator: Math.round(distribution.coCreator * scale),
      architect: Math.round(distribution.architect * scale),
    };
    const newTotal =
      normalized.observer +
      normalized.engager +
      normalized.coCreator +
      normalized.architect;
    if (newTotal !== 100) {
      normalized.engager += 100 - newTotal;
    }
    updateExperienceFlowStageDistribution(activeStageId, normalized);
  };

  const handlePresenceChange = (type: StagePresenceTypeCode, value: number) => {
    if (!activeStageId) return;
    const newPresence: StagePresenceTypes = {
      ...presenceTypes,
      [type]: value,
    };
    updateExperienceFlowStagePresence(activeStageId, newPresence);
  };

  const handleStartEdit = (stageId: string, currentName: string) => {
    setEditingStageId(stageId);
    setEditName(currentName);
  };

  const handleSaveEdit = () => {
    if (editingStageId && editName.trim()) {
      renameExperienceFlowStage(editingStageId, editName.trim());
    }
    setEditingStageId(null);
    setEditName("");
  };

  const handleDeleteStage = (stageId: string) => {
    if (stages.length <= 1) return;
    const deletedIndex = stages.findIndex((s) => s.id === stageId);
    removeExperienceFlowStage(stageId);
    setShowDeleteConfirm(null);
    // Select adjacent stage
    if (activeStageId === stageId) {
      const newIndex = Math.max(0, deletedIndex - 1);
      setActiveStageId(
        stages[newIndex === deletedIndex ? newIndex + 1 : newIndex]?.id || null,
      );
    }
  };

  const handleAddStage = () => {
    addExperienceFlowStage(
      currentStageIndex >= 0 ? currentStageIndex : stages.length - 1,
    );
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, stageId: string) => {
    setDraggedStageId(stageId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", stageId);
    // Make drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedStageId(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    // Only clear if leaving the container entirely
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedStageId) {
      reorderExperienceFlowStage(draggedStageId, targetIndex);
    }
    setDraggedStageId(null);
    setDragOverIndex(null);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="pointer-events-auto">
        {/* Collapsed bar */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-card/95 backdrop-blur-xl border-t border-border hover:bg-card transition-colors cursor-pointer"
        >
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Experience Flow</span>
          
          {/* Stage controls - only show when expanded */}
          {isExpanded && currentStage && (
            <div className="flex items-center gap-1 ml-auto mr-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  activeStageId && moveExperienceFlowStage(activeStageId, "left");
                }}
                disabled={currentStageIndex === 0}
                className="h-7 w-7 p-0"
                aria-label="Move left"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  activeStageId && moveExperienceFlowStage(activeStageId, "right");
                }}
                disabled={currentStageIndex === stages.length - 1}
                className="h-7 w-7 p-0"
                aria-label="Move right"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddStage();
                }}
                className="h-7 w-7 p-0"
                aria-label="Add stage"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit(currentStage.id, currentStage.name);
                }}
                className="h-7 w-7 p-0"
                aria-label="Rename stage"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              {showDeleteConfirm === currentStage.id ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStage(currentStage.id);
                    }}
                    disabled={stages.length <= 1}
                    className="h-7 text-xs px-2"
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(null);
                    }}
                    className="h-7 text-xs px-2"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(currentStage.id);
                  }}
                  disabled={stages.length <= 1}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  aria-label="Delete stage"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}
          
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* Expanded drawer */}
        <div
          className={`bg-card/95 backdrop-blur-xl border-t border-border transition-all duration-300 ease-out overflow-hidden ${
            isExpanded ? "max-h-[380px]" : "max-h-0"
          }`}
        >
          <div className="p-4">
            {/* Stage tabs with Add button */}
            <div className="flex gap-1 mb-4 p-1 bg-secondary/30 rounded-lg items-stretch overflow-x-auto">
              {stages.map((stage, index) => {
                const stageDist =
                  stage.engagementDistribution ||
                  DEFAULT_ENGAGEMENT_DISTRIBUTION;
                const stageTotal =
                  stageDist.observer +
                  stageDist.engager +
                  stageDist.coCreator +
                  stageDist.architect;
                const isActive = activeStageId === stage.id;
                const isEditing = editingStageId === stage.id;
                const isDragging = draggedStageId === stage.id;
                const isDragOver =
                  dragOverIndex === index && draggedStageId !== stage.id;

                return (
                  <button
                    key={stage.id}
                    ref={(el) => {
                      if (el) stageRefs.current.set(stage.id, el);
                    }}
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, stage.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onClick={() => !isEditing && setActiveStageId(stage.id)}
                    className={`flex-1 min-w-[100px] py-2 px-3 text-xs font-medium rounded-md transition-all flex flex-col items-center gap-1.5 cursor-grab active:cursor-grabbing ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    } ${isDragging ? "opacity-50" : ""} ${isDragOver ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
                  >
                    {isEditing ? (
                      <Input
                        ref={inputRef}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") {
                            setEditingStageId(null);
                            setEditName("");
                          }
                        }}
                        className="h-5 text-xs text-center bg-transparent border-none px-1"
                        onClick={(e) => e.stopPropagation()}
                        draggable={false}
                      />
                    ) : (
                      <span className="truncate max-w-full">{stage.name}</span>
                    )}
                    {/* Engagement distribution mini bar */}
                    <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-black/20">
                      {stageTotal > 0 ? (
                        <>
                          {stageDist.observer > 0 && (
                            <div
                              className="h-full bg-cyan-400/80"
                              style={{
                                width: `${(stageDist.observer / stageTotal) * 100}%`,
                              }}
                            />
                          )}
                          {stageDist.engager > 0 && (
                            <div
                              className="h-full bg-violet-400/80"
                              style={{
                                width: `${(stageDist.engager / stageTotal) * 100}%`,
                              }}
                            />
                          )}
                          {stageDist.coCreator > 0 && (
                            <div
                              className="h-full bg-fuchsia-400/80"
                              style={{
                                width: `${(stageDist.coCreator / stageTotal) * 100}%`,
                              }}
                            />
                          )}
                          {stageDist.architect > 0 && (
                            <div
                              className="h-full bg-amber-400/80"
                              style={{
                                width: `${(stageDist.architect / stageTotal) * 100}%`,
                              }}
                            />
                          )}
                        </>
                      ) : (
                        <div className="h-full w-full bg-violet-400/80" />
                      )}
                    </div>
                    {/* Time indicator */}
                    {stage.estimatedMinutes !== null &&
                      stage.estimatedMinutes > 0 && (
                        <span className="text-muted-foreground/80 font-sans text-[12px] text-[#4f3978]">
                          {stage.estimatedMinutes}m
                        </span>
                      )}
                  </button>
                );
              })}
              {/* Add stage button */}
              <button
                onClick={handleAddStage}
                className="flex items-center justify-center px-2 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
                aria-label="Add stage"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Stage content */}
            {currentStage && (
              <div className="space-y-3">

                {/* 3-column layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Column 1: Degree of Engagement */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">
                        Degree of Engagement
                      </Label>
                      <span
                        className={`text-sm font-mono ${total === 100 ? "text-primary" : "text-amber-500"}`}
                      >
                        {total}%
                      </span>
                    </div>

                    {/* 4 Engagement Level Sliders */}
                    <div className="space-y-2">
                      {ENGAGEMENT_LEVELS.map((level) => (
                        <div key={level.code} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">
                              {level.label}
                            </Label>
                            <span className="text-xs font-mono text-primary">
                              {distribution[level.code]}%
                            </span>
                          </div>
                          <input
                            type="range"
                            value={distribution[level.code]}
                            onChange={(e) =>
                              handleDistributionChange(level.code, parseInt(e.target.value))
                            }
                            max={100}
                            min={0}
                            step={1}
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                            aria-label={`${level.label} engagement level`}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Warning and Normalize button */}
                    {total !== 100 && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span className="text-xs text-amber-500 flex-1">
                          ≠100%
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNormalize}
                          className="h-5 text-[10px] px-1.5"
                        >
                          Fix
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Column 2: Presence Types */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Presence</Label>
                    <div className="flex gap-3 h-[180px]">
                      {/* Left: 2-column x 3-row presence buttons grid */}
                      <div className="grid grid-cols-2 grid-rows-3 gap-1.5 flex-1">
                        {STAGE_PRESENCE_TYPES.map((pt) => {
                          const pct = presenceTypes[pt.code];
                          const isSelected = selectedPresenceType === pt.code;
                          return (
                            <button
                              key={pt.code}
                              onClick={() => setSelectedPresenceType(pt.code)}
                              className={`presence-btn presence-btn-${pt.code} relative overflow-hidden ${isSelected ? "selected" : ""}`}
                              style={{
                                border: `1.5px solid hsl(var(--presence-${pt.code}) / ${isSelected ? 1 : 0.5})`,
                                backgroundColor: "transparent",
                              }}
                              aria-label={`${pt.label}: ${pct}%`}
                              title={`${pt.label}: ${pct}%`}
                            >
                              {/* Fill from bottom to top */}
                              <div
                                className="absolute inset-x-0 bottom-0 transition-all duration-200 pointer-events-none rounded-b-md"
                                style={{
                                  height: `${pct}%`,
                                  backgroundColor: `hsl(var(--presence-${pt.code}) / ${0.3 + pct / 200})`,
                                  boxShadow:
                                    pct > 30
                                      ? `inset 0 0 12px hsl(var(--presence-${pt.code}) / 0.4)`
                                      : "none",
                                }}
                              />
                              <span
                                className={`relative z-10 transition-colors ${isSelected ? "text-white" : pct > 50 ? "text-white/90" : "text-muted-foreground"}`}
                              >
                                {PRESENCE_ICONS[pt.code]}
                              </span>
                              <span
                                className={`relative z-10 text-[9px] font-medium truncate ${isSelected ? "text-white" : pct > 50 ? "text-white/80" : "text-muted-foreground"}`}
                              >
                                {pt.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Right: Vertical fader */}
                      <div className="flex flex-col items-center gap-2 w-12">
                        <span className="text-xs font-mono text-primary font-semibold">
                          {presenceTypes[selectedPresenceType]}%
                        </span>
                        <div
                          className="vertical-slider flex-1 w-8"
                          role="slider"
                          aria-valuenow={presenceTypes[selectedPresenceType]}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${STAGE_PRESENCE_TYPES.find((p) => p.code === selectedPresenceType)?.label} presence level`}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            const current = presenceTypes[selectedPresenceType];
                            if (e.key === "ArrowUp" || e.key === "ArrowRight") {
                              e.preventDefault();
                              handlePresenceChange(
                                selectedPresenceType,
                                Math.min(100, current + (e.shiftKey ? 10 : 1)),
                              );
                            } else if (
                              e.key === "ArrowDown" ||
                              e.key === "ArrowLeft"
                            ) {
                              e.preventDefault();
                              handlePresenceChange(
                                selectedPresenceType,
                                Math.max(0, current - (e.shiftKey ? 10 : 1)),
                              );
                            }
                          }}
                          onMouseDown={(e) => {
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            const handleMove = (moveEvent: MouseEvent) => {
                              const y = moveEvent.clientY - rect.top;
                              const percent = Math.round(
                                Math.max(
                                  0,
                                  Math.min(100, 100 - (y / rect.height) * 100),
                                ),
                              );
                              handlePresenceChange(
                                selectedPresenceType,
                                percent,
                              );
                            };
                            const handleUp = () => {
                              document.removeEventListener(
                                "mousemove",
                                handleMove,
                              );
                              document.removeEventListener("mouseup", handleUp);
                            };
                            handleMove(e.nativeEvent);
                            document.addEventListener("mousemove", handleMove);
                            document.addEventListener("mouseup", handleUp);
                          }}
                        >
                          <div
                            className="vertical-slider-fill"
                            style={{
                              height: `${presenceTypes[selectedPresenceType]}%`,
                              backgroundColor: `hsl(var(--presence-${selectedPresenceType}))`,
                              boxShadow: `0 0 8px hsl(var(--presence-${selectedPresenceType}) / 0.5)`,
                            }}
                          />
                          <div
                            className="vertical-slider-thumb"
                            style={{
                              bottom: `calc(${presenceTypes[selectedPresenceType]}% - 6px)`,
                              borderColor: `hsl(var(--presence-${selectedPresenceType}))`,
                            }}
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                          {
                            STAGE_PRESENCE_TYPES.find(
                              (p) => p.code === selectedPresenceType,
                            )?.label
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Narrative Notes + Estimated Time */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      Narrative Notes
                    </Label>
                    <Textarea
                      placeholder={`What happens during ${currentStage.name.toLowerCase()}?`}
                      value={currentStage.narrativeNotes}
                      onChange={(e) =>
                        activeStageId &&
                        updateExperienceFlowStageNarrative(
                          activeStageId,
                          e.target.value,
                        )
                      }
                      className="min-h-[120px] bg-input border-border resize-none text-sm"
                    />
                    <div className="space-y-1 pt-2 border-t border-border">
                      <Label className="text-xs text-muted-foreground">
                        Estimated time (minutes)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={999}
                        placeholder="—"
                        value={currentStage.estimatedMinutes ?? ""}
                        onChange={(e) => {
                          if (!activeStageId) return;
                          const val = e.target.value;
                          if (val === "") {
                            updateExperienceFlowStageTime(activeStageId, null);
                          } else {
                            const num = Math.max(
                              0,
                              Math.min(999, parseInt(val, 10) || 0),
                            );
                            updateExperienceFlowStageTime(activeStageId, num);
                          }
                        }}
                        className="h-8 text-sm bg-input border-border"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Used to estimate the pacing across stages.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
