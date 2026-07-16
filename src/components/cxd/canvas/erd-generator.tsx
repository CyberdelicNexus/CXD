"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, FileText, Download, RefreshCw, Plus, StickyNote, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCXDStore } from "@/store/cxd-store";
import { useAICredits } from "@/hooks/use-ai-credits";
import { getFullProjectContext } from "@/utils/ai-context-aggregator";
import {
  getERDPrompt,
  ERD_SECTIONS,
  type ERDAudience,
  type ERDDetail,
} from "@/lib/ai/erd-prompt";
import { formatERDMarkdown } from "@/lib/ai/erd-formatter";
import { exportToMarkdown, exportToPDF, exportToDOCX } from "@/lib/document-export";
import { ERDMarkdown } from "./erd-markdown";
import type { AIProviderKey } from "@/types/ai-types";

const PROGRESS_STAGES = [
  { at: 0, label: "Collecting project context..." },
  { at: 8, label: "Analyzing framing dimensions..." },
  { at: 18, label: "Mapping reality planes..." },
  { at: 28, label: "Evaluating sensory domains..." },
  { at: 38, label: "Processing experience flow..." },
  { at: 48, label: "Analyzing presence & states..." },
  { at: 58, label: "Synthesizing trait mapping..." },
  { at: 68, label: "Generating requirement sections..." },
  { at: 80, label: "Compiling technical requirements..." },
  { at: 90, label: "Finalizing document..." },
];

function getStageLabel(progress: number): string {
  for (let i = PROGRESS_STAGES.length - 1; i >= 0; i--) {
    if (progress >= PROGRESS_STAGES[i].at) return PROGRESS_STAGES[i].label;
  }
  return PROGRESS_STAGES[0].label;
}

const AUDIENCE_CHOICES: { value: ERDAudience; label: string }[] = [
  { value: "technical", label: "Technical team" },
  { value: "creative", label: "Creative team" },
  { value: "stakeholders", label: "Stakeholders" },
];

const DETAIL_CHOICES: { value: ERDDetail; label: string }[] = [
  { value: "concise", label: "Concise" },
  { value: "standard", label: "Standard" },
  { value: "comprehensive", label: "Comprehensive" },
];

const TONE_MAX_LENGTH = 200;

const paramPillCls = (active: boolean) =>
  cn(
    "rounded-full border px-3 py-1 text-[11px] transition-colors",
    active
      ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
      : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/25 hover:text-white/80",
  );

interface ERDGeneratorProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  provider?: AIProviderKey;
}

export function ERDGenerator({
  projectId,
  isOpen,
  onClose,
  provider: providerProp,
}: ERDGeneratorProps) {
  const [content, setContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showPlaceMenu, setShowPlaceMenu] = useState(false);
  const placeMenuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Generation parameters. Defaults reproduce the original behavior:
  // no audience emphasis, standard detail, all sections, no tone note.
  const [audience, setAudience] = useState<ERDAudience | "">("");
  const [detail, setDetail] = useState<ERDDetail>("standard");
  const [sectionIds, setSectionIds] = useState<string[]>(() => ERD_SECTIONS.map((s) => s.id));
  const [tone, setTone] = useState("");

  const toggleSection = useCallback((id: string) => {
    setSectionIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }, []);

  useEffect(() => { setMounted(true); }, []);

  // Use the globally selected model from the credit meter, falling back to prop/default
  const { selectedModel } = useAICredits();
  const provider = providerProp || selectedModel || "gemini";

  const projects = useCXDStore((s) => s.projects);
  const addCanvasElement = useCXDStore((s) => s.addCanvasElement);
  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );

  const projectName = project?.name || project?.intentionCore?.projectName || "Untitled";

  // Cleanup progress interval on unmount
  useEffect(() => {
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  const generate = useCallback(async () => {
    if (!project) return;

    setIsGenerating(true);
    setError(null);
    setContent("");
    setProgress(0);

    // Simulate progress: advance gradually up to 92%, then hold until done
    if (progressRef.current) clearInterval(progressRef.current);
    let current = 0;
    progressRef.current = setInterval(() => {
      // Slow down as we approach 92%
      const increment = current < 40 ? 2 : current < 70 ? 1.2 : current < 85 ? 0.6 : 0.2;
      current = Math.min(current + increment, 92);
      setProgress(current);
    }, 600);

    try {
      const elements = project.canvasLayout?.elements || [];
      const edges = project.canvasLayout?.edges || [];
      const fullContext = getFullProjectContext(project, elements, edges);
      const allSelected = sectionIds.length === ERD_SECTIONS.length;
      const erdPrompt = getERDPrompt(fullContext, {
        audience,
        detail,
        sections: allSelected ? undefined : sectionIds,
        tone: tone.trim().slice(0, TONE_MAX_LENGTH),
      });

      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceKey: "general",
          projectContext: fullContext,
          provider,
          analysisType: "erd",
          erdPrompt,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const erdContent = formatERDMarkdown(data.content || "");

      // Complete the progress bar
      if (progressRef.current) clearInterval(progressRef.current);
      setProgress(100);

      // Brief delay so user sees 100% before content appears
      await new Promise((r) => setTimeout(r, 400));
      setContent(erdContent);

      // Save ERD as an archived chat thread for version history
      if (erdContent) {
        const erdMessages = [
          {
            id: crypto.randomUUID(),
            role: "user",
            parts: [{ type: "text", text: "Generate Experience Requirement Document" }],
            content: "Generate Experience Requirement Document",
          },
          {
            id: crypto.randomUUID(),
            role: "assistant",
            parts: [{ type: "text", text: erdContent }],
            content: erdContent,
          },
        ];

        // Save to active "erd" thread, then archive it so it appears in history
        fetch("/api/ai/threads", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            faceKey: "erd",
            faceLabel: "ERD",
            faceHue: 270,
            messages: erdMessages,
          }),
        })
          .then(() =>
            fetch("/api/ai/threads", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                projectId,
                faceKey: "erd",
                faceLabel: "ERD",
                faceHue: 270,
                newSession: true,
              }),
            }),
          )
          .catch(() => {
            // Silent fail — ERD still displayed even if history save fails
          });
      }
    } catch (err) {
      if (progressRef.current) clearInterval(progressRef.current);
      setError(err instanceof Error ? err.message : "Failed to generate ERD");
    } finally {
      if (progressRef.current) clearInterval(progressRef.current);
      progressRef.current = null;
      setIsGenerating(false);
    }
  }, [project, provider, projectId, audience, detail, sectionIds, tone]);

  const handleExport = useCallback(
    async (format: "md" | "pdf" | "docx") => {
      if (!content) return;
      const filename = `ERD-${projectName.replace(/\s+/g, "-")}`;

      if (format === "md") {
        exportToMarkdown(content, filename);
      } else if (format === "pdf") {
        await exportToPDF(content, filename);
      } else {
        await exportToDOCX(content, filename);
      }
    },
    [content, projectName],
  );

  const handlePlaceAsNoteCard = useCallback(async () => {
    if (!content || !project) return;

    // Convert markdown to HTML
    const { marked } = await import('marked');
    const noteBodyHtml = await marked.parse(content, {
      breaks: true,
      gfm: true,
    });

    // Create a note card element in the inbox
    const noteElement: any = {
      id: `erd-note-${Date.now()}`,
      type: 'freeform',
      cardType: 'note',
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      noteTitle: `ERD: ${projectName}`,
      noteBody: noteBodyHtml,
      content: '',
      emoji: '📄',
      inInbox: true,
    };

    addCanvasElement(noteElement);
    setShowPlaceMenu(false);

    // Pulse the inbox to show the user where it went
    window.dispatchEvent(
      new CustomEvent('cxd:pulse-task-inbox', { detail: { durationMs: 3000 } }),
    );
  }, [content, project, projectName, addCanvasElement]);

  const handlePlaceAsPDF = useCallback(async () => {
    if (!content || !project) return;

    // Convert markdown to HTML
    const { marked } = await import('marked');
    const noteBodyHtml = await marked.parse(content, {
      breaks: true,
      gfm: true,
    });

    // Calculate word count
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

    // Create a document element on canvas (compact icon representation)
    const docElement: any = {
      id: `erd-doc-${Date.now()}`,
      type: 'freeform',
      cardType: 'note',
      x: 200,
      y: 200,
      width: 180,
      height: 200,
      noteTitle: `${projectName} - ERD`,
      noteBody: noteBodyHtml,
      content: '',
      emoji: '📄',
      inInbox: false,
      isDocument: true,
      wordCount,
    };

    addCanvasElement(docElement);
    setShowPlaceMenu(false);
  }, [content, project, projectName, addCanvasElement]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (placeMenuRef.current && !placeMenuRef.current.contains(e.target as Node)) {
        setShowPlaceMenu(false);
      }
    };

    if (showPlaceMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPlaceMenu]);

  // Close on Escape while open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-label="Experience Requirement Document"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal */}
      <div
        className="relative w-full max-w-4xl max-h-[85vh] mx-4 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Experience Requirement Document
              </h2>
              <p className="text-xs text-muted-foreground">
                {projectName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {content && !isGenerating && (
              <>
                <button
                  onClick={() => handleExport("md")}
                  className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-foreground rounded-md transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3 h-3" />
                  .md
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-foreground rounded-md transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3 h-3" />
                  .pdf
                </button>
                <button
                  onClick={() => handleExport("docx")}
                  className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-foreground rounded-md transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3 h-3" />
                  .docx
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                {/* Place on Canvas dropdown */}
                <div className="relative" ref={placeMenuRef}>
                  <button
                    onClick={() => setShowPlaceMenu(!showPlaceMenu)}
                    className="px-3 py-1.5 text-xs bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-md transition-colors flex items-center gap-1.5"
                    title="Place document on canvas"
                  >
                    <Plus className="w-3 h-3" />
                    Place on Canvas
                  </button>
                  {showPlaceMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50">
                      <button
                        onClick={handlePlaceAsNoteCard}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-3"
                      >
                        <StickyNote className="w-4 h-4 text-amber-400" />
                        <div>
                          <div className="font-medium text-foreground">Note Card</div>
                          <div className="text-xs text-muted-foreground">Place in inbox</div>
                        </div>
                      </button>
                      <div className="h-px bg-border" />
                      <button
                        onClick={handlePlaceAsPDF}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-3"
                      >
                        <FileUp className="w-4 h-4 text-blue-400" />
                        <div>
                          <div className="font-medium text-foreground">Document</div>
                          <div className="text-xs text-muted-foreground">Place on canvas</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                <button
                  onClick={generate}
                  className="px-3 py-1.5 text-xs bg-primary/20 hover:bg-primary/30 text-primary rounded-md transition-colors flex items-center gap-1.5"
                  title="Regenerate"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerate
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: "thin" }}>
          {!content && !isGenerating && !error && (
            <div className="flex flex-col items-center py-8">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Generate Your ERD
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed text-center">
                This will analyze your entire project across all six dimensions
                and produce a structured Experience Requirement Document.
                Tune the parameters below or generate with the defaults.
              </p>

              {/* Generation parameters */}
              <div className="w-full max-w-xl mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4 text-left">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Audience
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {AUDIENCE_CHOICES.map((choice) => (
                        <button
                          key={choice.value}
                          type="button"
                          onClick={() =>
                            setAudience((a) => (a === choice.value ? "" : choice.value))
                          }
                          className={paramPillCls(audience === choice.value)}
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Detail level
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {DETAIL_CHOICES.map((choice) => (
                        <button
                          key={choice.value}
                          type="button"
                          onClick={() => setDetail(choice.value)}
                          className={paramPillCls(detail === choice.value)}
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Sections ({sectionIds.length}/{ERD_SECTIONS.length})
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setSectionIds(
                          sectionIds.length === ERD_SECTIONS.length
                            ? []
                            : ERD_SECTIONS.map((s) => s.id),
                        )
                      }
                      className="text-[10px] text-violet-300/80 hover:text-violet-200 transition-colors"
                    >
                      {sectionIds.length === ERD_SECTIONS.length ? "Clear all" : "Select all"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                    {ERD_SECTIONS.map((section) => (
                      <label
                        key={section.id}
                        className="flex cursor-pointer items-center gap-2 text-xs text-foreground/70 hover:text-foreground transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={sectionIds.includes(section.id)}
                          onChange={() => toggleSection(section.id)}
                          className="h-3 w-3 accent-violet-500"
                        />
                        {section.title}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Tone note (optional)
                  </p>
                  <input
                    type="text"
                    value={tone}
                    onChange={(e) => setTone(e.target.value.slice(0, TONE_MAX_LENGTH))}
                    maxLength={TONE_MAX_LENGTH}
                    placeholder="e.g. warm and plainspoken, or formal for a funding board"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-violet-400/50"
                  />
                </div>
              </div>

              <button
                onClick={generate}
                disabled={sectionIds.length === 0}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileText className="w-4 h-4" />
                Generate ERD
              </button>
              {sectionIds.length === 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Select at least one section to generate.
                </p>
              )}
            </div>
          )}

          {isGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 px-8">
              <FileText className="w-10 h-10 text-primary/40 mb-6" />

              {/* Percentage */}
              <p className="text-2xl font-semibold text-foreground tabular-nums mb-3">
                {Math.round(progress)}%
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-sm h-2 rounded-full bg-white/[0.06] overflow-hidden mb-4">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    progress >= 100
                      ? "bg-emerald-500"
                      : progress > 60
                        ? "bg-violet-500"
                        : "bg-primary",
                  )}
                  style={{ width: `${Math.max(progress, 1)}%` }}
                />
              </div>

              {/* Stage label */}
              <p className="text-sm text-muted-foreground transition-opacity duration-300">
                {getStageLabel(progress)}
              </p>
              <p className="text-xs text-muted-foreground/40 mt-2">
                This may take a minute for complex projects.
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <p className="text-sm text-red-400 mb-4">{error}</p>
              <button
                onClick={generate}
                className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors text-sm"
              >
                Try Again
              </button>
            </div>
          )}

          {content && !isGenerating && (
            <ERDMarkdown content={content} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
