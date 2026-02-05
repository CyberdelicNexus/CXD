"use client";

import { useState, useRef, useEffect } from "react";
import { useCXDStore } from "@/store/cxd-store";
import { extractCenterColor, hexToRgba, cn } from "@/lib/utils";
import {
  ENGAGEMENT_LEVELS,
  EngagementLevelCode,
  EngagementDistribution,
  DEFAULT_ENGAGEMENT_DISTRIBUTION,
  STAGE_PRESENCE_TYPES,
  StagePresenceTypeCode,
  StagePresenceTypes,
  DEFAULT_STAGE_PRESENCE_TYPES,
  REALITY_PLANES,
  RealityPlaneCode,
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
  Eye,
  Layers,
  Monitor,
  Box,
  Globe,
  Smartphone,
  Cpu,
  Fingerprint,
  Lightbulb,
} from "lucide-react";

// Icon map for reality planes
const REALITY_ICONS: Record<RealityPlaneCode, React.ReactNode> = {
  PR: <Box className="w-3.5 h-3.5" />,
  VR: <Monitor className="w-3.5 h-3.5" />,
  AR: <Smartphone className="w-3.5 h-3.5" />,
  MR: <Globe className="w-3.5 h-3.5" />,
  GR: <Cpu className="w-3.5 h-3.5" />,
  BR: <Fingerprint className="w-3.5 h-3.5" />,
  CR: <Lightbulb className="w-3.5 h-3.5" />,
};

// Icon map for presence types
const PRESENCE_ICONS: Record<StagePresenceTypeCode, React.ReactNode> = {
  mental: <Brain className="w-4 h-4" />,
  emotional: <Heart className="w-4 h-4" />,
  social: <Users className="w-4 h-4" />,
  embodied: <Footprints className="w-4 h-4" />,
  environmental: <Leaf className="w-4 h-4" />,
  active: <Zap className="w-4 h-4" />,
};

// Icon map for engagement levels
const ENGAGEMENT_ICONS: Record<EngagementLevelCode, React.ReactNode> = {
  observer: <Eye className="w-4 h-4" />,
  engager: <Zap className="w-4 h-4" />,
  coCreator: <Users className="w-4 h-4" />,
  architect: <Layers className="w-4 h-4" />,
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
    toggleExperienceFlowStageRealityPlane,
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

  // Dynamic background based on canvas background
  const canvasBackground = project.canvasBackground || 'radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)';
  const centerColor = extractCenterColor(canvasBackground);
  const drawerBgColor = hexToRgba(centerColor, 0.95);

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

  const handleDistributionToggle = (level: EngagementLevelCode) => {
    if (!activeStageId) return;
    const isSelected = distribution[level] > 0;
    const newDistribution: EngagementDistribution = {
      ...distribution,
      [level]: isSelected ? 0 : 100,
    };
    updateExperienceFlowStageDistribution(activeStageId, newDistribution);
  };

  const handlePresenceToggle = (type: StagePresenceTypeCode) => {
    if (!activeStageId) return;
    const isSelected = presenceTypes[type] > 0;
    const newPresence: StagePresenceTypes = {
      ...presenceTypes,
      [type]: isSelected ? 0 : 100,
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
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 backdrop-blur-xl border-t border-border hover:brightness-110 transition-colors cursor-pointer"
          style={{ backgroundColor: drawerBgColor }}
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
          className={`backdrop-blur-xl border-t border-border transition-all duration-300 ease-out overflow-hidden ${isExpanded ? "max-h-[520px]" : "max-h-0"
            }`}
          style={{ backgroundColor: drawerBgColor }}
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
                    className={cn(
                      "flex-1 min-w-[100px] py-1.5 px-3 text-[11px] font-medium rounded-md transition-all flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing border",
                      isActive
                        ? "bg-gradient-to-b from-violet-600/30 to-violet-950/60 border-violet-500/50 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                        : "text-white/40 border-transparent hover:text-white/70 hover:bg-white/10",
                      isDragging && "opacity-50",
                      isDragOver && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                    )}
                  >
                    <div className="min-h-[1.5rem] mt-0.5 flex flex-col items-center">
                      {isEditing ? (
                        <div className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10 shadow-inner">
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
                            className="h-4 text-[10px] font-bold uppercase tracking-wider text-center bg-transparent border-none px-1 w-[80px]"
                            onClick={(e) => e.stopPropagation()}
                            draggable={false}
                          />
                        </div>
                      ) : (
                        <div className={cn(
                          "px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500",
                          isActive
                            ? "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/40 text-white shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                            : "bg-white/5 border border-white/5 text-white/30"
                        )}>
                          {stage.name}
                        </div>
                      )}
                    </div>

                    {/* Presence & Reality Icons - Horizontal Split */}
                    <div className="flex items-center justify-center gap-4 mt-2">
                      {/* Presence Column */}
                      <div className="flex items-center gap-1.5 min-w-[32px] justify-end">
                        {Object.entries(stage.presenceTypes || DEFAULT_STAGE_PRESENCE_TYPES)
                          .filter(([_, val]) => val > 0)
                          .map(([type]) => (
                            <div
                              key={`presence-${type}`}
                              className="w-3 h-3 flex items-center justify-center transition-all"
                              style={{ color: `hsl(var(--presence-${type}))` }}
                              title={`Presence: ${type}`}
                            >
                              <div className="scale-90">{PRESENCE_ICONS[type as StagePresenceTypeCode]}</div>
                            </div>
                          ))
                        }
                      </div>

                      {/* Vertical Divider - Thicker Purple */}
                      <div className="w-[1.5px] h-4 bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.4)]" />

                      {/* Reality Column */}
                      <div className="flex items-center gap-1.5 min-w-[32px] justify-start">
                        {Object.entries(stage.realityPlanes || {})
                          .filter(([_, enabled]) => enabled)
                          .map(([code]) => {
                            const rp = REALITY_PLANES.find(r => r.code === code);
                            return (
                              <div
                                key={`reality-${code}`}
                                className="w-3 h-3 flex items-center justify-center transition-all text-white"
                                title={`Reality: ${rp?.label || code}`}
                              >
                                <div className="scale-90">{REALITY_ICONS[code as RealityPlaneCode]}</div>
                              </div>
                            );
                          })
                        }
                      </div>

                      {Object.values(stage.presenceTypes || DEFAULT_STAGE_PRESENCE_TYPES).every(v => v === 0) &&
                        (!stage.realityPlanes || Object.values(stage.realityPlanes).every(v => !v)) && (
                          <div className="w-1 h-1 rounded-full bg-white/20" />
                        )}
                    </div>

                    {/* Engagement distribution visualizer (Simplified for categorical) */}
                    <div className="w-full h-1 rounded-full overflow-hidden flex bg-white/5 mt-2">
                      {Object.entries(stageDist).some(([_, v]) => v > 0) ? (
                        <>
                          {stageDist.observer > 0 && <div className="h-full flex-1 bg-cyan-400/60" />}
                          {stageDist.engager > 0 && <div className="h-full flex-1 bg-violet-400/60" />}
                          {stageDist.coCreator > 0 && <div className="h-full flex-1 bg-fuchsia-400/60" />}
                          {stageDist.architect > 0 && <div className="h-full flex-1 bg-amber-400/60" />}
                        </>
                      ) : (
                        <div className="h-full w-full bg-white/5" />
                      )}
                    </div>

                    {/* Time indicator - Brighter & More Prominent */}
                    {(stage.estimatedMinutes ?? 0) > 0 && (
                      <span className="text-violet-400 font-bold text-[13px] mt-2 font-mono tracking-tight">
                        {stage.estimatedMinutes} MIN
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

                {/* 4-column layout: 10% | 20% | 20% | 50% */}
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  {/* Column 1: Degree of Engagement (10%) */}
                  <div className="w-full md:w-[10%] space-y-4">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-1 block">Engagement</Label>
                    <div className="flex flex-col gap-2">
                      {ENGAGEMENT_LEVELS.map((level) => {
                        const isSelected = distribution[level.code] > 0;
                        const colors = {
                          observer: "from-cyan-500/20 to-cyan-950/40 border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]",
                          engager: "from-violet-500/20 to-violet-950/40 border-violet-500/40 text-violet-400 shadow-[0_0_15px_rgba(167,139,250,0.15)]",
                          coCreator: "from-fuchsia-500/20 to-fuchsia-950/40 border-fuchsia-500/40 text-fuchsia-400 shadow-[0_0_15px_rgba(232,121,249,0.15)]",
                          architect: "from-amber-500/20 to-amber-950/40 border-amber-500/40 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.15)]"
                        };

                        return (
                          <button
                            key={level.code}
                            onClick={() => handleDistributionToggle(level.code)}
                            className={cn(
                              "flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 relative active:scale-95 group",
                              isSelected
                                ? "bg-gradient-to-b border-opacity-70 " + colors[level.code]
                                : "bg-white/[0.05] border-white/10 text-white/40 hover:bg-white/[0.08] hover:border-white/20"
                            )}
                            title={level.label}
                          >
                            <div className={cn(
                              "mb-1 transition-all duration-500",
                              isSelected ? "scale-110" : "opacity-60 grayscale-[0.3]"
                            )}>
                              {ENGAGEMENT_ICONS[level.code]}
                            </div>
                            <span className={cn(
                              "text-[8px] font-bold uppercase tracking-tight text-center leading-none",
                              isSelected ? "text-white" : "text-white/40"
                            )}>{level.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Column 2: Presence Types (20%) - Split 4 & 2 */}
                  <div className="w-full md:w-[20%] space-y-4">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-1 block">Presence</Label>
                    <div className="flex gap-2">
                      {/* Left Column (4 items) */}
                      <div className="flex-1 flex flex-col gap-2">
                        {STAGE_PRESENCE_TYPES.slice(0, 4).map((pt) => {
                          const isSelected = presenceTypes[pt.code] > 0;
                          return (
                            <button
                              key={pt.code}
                              onClick={() => handlePresenceToggle(pt.code)}
                              className={cn(
                                "flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 relative active:scale-95",
                                isSelected
                                  ? "bg-gradient-to-br from-white/[0.1] to-transparent border-opacity-80 shadow-[0_0_15px_rgba(255,255,255,0.02)]"
                                  : "bg-white/[0.05] border-white/10 opacity-60 hover:opacity-100 hover:bg-white/[0.08]"
                              )}
                              style={{
                                borderColor: isSelected ? `hsl(var(--presence-${pt.code}))` : 'rgba(255,255,255,0.1)',
                                color: isSelected ? `hsl(var(--presence-${pt.code}))` : 'rgba(255,255,255,0.4)'
                              }}
                              title={pt.label}
                            >
                              <div className="mb-0.5 scale-90">{PRESENCE_ICONS[pt.code]}</div>
                              <span className={cn(
                                "text-[9px] font-bold uppercase tracking-tight leading-none",
                                isSelected ? "text-white" : "text-white/40"
                              )}>
                                {pt.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {/* Right Column (2 items) */}
                      <div className="flex-1 flex flex-col gap-2">
                        {STAGE_PRESENCE_TYPES.slice(4, 6).map((pt) => {
                          const isSelected = presenceTypes[pt.code] > 0;
                          return (
                            <button
                              key={pt.code}
                              onClick={() => handlePresenceToggle(pt.code)}
                              className={cn(
                                "flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 relative active:scale-95",
                                isSelected
                                  ? "bg-gradient-to-br from-white/[0.1] to-transparent border-opacity-80 shadow-[0_0_15px_rgba(255,255,255,0.02)]"
                                  : "bg-white/[0.05] border-white/10 opacity-60 hover:opacity-100 hover:bg-white/[0.08]"
                              )}
                              style={{
                                borderColor: isSelected ? `hsl(var(--presence-${pt.code}))` : 'rgba(255,255,255,0.1)',
                                color: isSelected ? `hsl(var(--presence-${pt.code}))` : 'rgba(255,255,255,0.4)'
                              }}
                              title={pt.label}
                            >
                              <div className="mb-0.5 scale-90">{PRESENCE_ICONS[pt.code]}</div>
                              <span className={cn(
                                "text-[9px] font-bold uppercase tracking-tight leading-none",
                                isSelected ? "text-white" : "text-white/40"
                              )}>
                                {pt.label}
                              </span>
                            </button>
                          );
                        })}
                        {/* Empty space filler to keep alignment */}
                        <div className="flex-1" />
                        <div className="flex-1" />
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Reality Planes (20%) */}
                  <div className="w-full md:w-[20%] space-y-4">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-1 block">Reality</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {REALITY_PLANES.map((rp) => {
                        const stagePlanes = (currentStage.realityPlanes || {}) as Record<RealityPlaneCode, boolean>;
                        const isEnabled = stagePlanes[rp.code as RealityPlaneCode];
                        return (
                          <button
                            key={rp.code}
                            onClick={() => toggleExperienceFlowStageRealityPlane(currentStage.id, rp.code as RealityPlaneCode)}
                            className={cn(
                              "flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 relative active:scale-95",
                              isEnabled
                                ? "bg-gradient-to-br from-white/[0.08] to-transparent border-white/40 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                                : "bg-white/[0.05] border-white/10 text-white/40 opacity-70 hover:opacity-100 hover:bg-white/[0.08]"
                            )}
                            title={rp.label}
                          >
                            <div className="mb-0.5 scale-90">{REALITY_ICONS[rp.code as RealityPlaneCode]}</div>
                            <span className={cn(
                              "text-[9px] font-bold tracking-widest leading-none",
                              isEnabled ? "text-white" : "text-white/40"
                            )}>
                              {rp.code}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Column 4: Experience Script (50%) */}
                  <div className="w-full md:w-[50%] space-y-4">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-1 block">Experience Script</Label>
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
                        className="min-h-[140px] bg-white/[0.03] border-white/10 rounded-xl resize-none text-[12px] leading-relaxed placeholder:text-white/10 focus:ring-1 focus:ring-violet-500/30 transition-all font-sans"
                      />
                    </div>
                    <div className="space-y-3 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            max={999}
                            placeholder="0"
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
                            className="h-11 w-24 text-center text-base bg-white/[0.04] border-white/10 rounded-xl font-mono focus:ring-1 focus:ring-violet-500/40"
                          />
                          <span className="absolute -top-2 -right-1 px-1 bg-background text-[8px] font-black uppercase text-violet-400 rounded border border-violet-500/20">MIN</span>
                        </div>
                        <div className="flex-1">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-white/50 block leading-tight">
                            Temporal Weight
                          </Label>
                          <p className="text-[9px] text-white/20 italic">
                            Stage duration for timeline pacing
                          </p>
                        </div>
                      </div>
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
