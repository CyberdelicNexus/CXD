"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { X, FileText, Download, RefreshCw, Plus, StickyNote, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCXDStore } from "@/store/cxd-store";
import { useAICredits } from "@/hooks/use-ai-credits";
import { getFullProjectContext } from "@/utils/ai-context-aggregator";
import { getERDPrompt } from "@/lib/ai/erd-prompt";
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

  // Use the globally selected model from the credit meter, falling back to prop/default
  const { selectedModel } = useAICredits();
  const provider = providerProp || selectedModel || "gpt";

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
      const erdPrompt = getERDPrompt(fullContext);

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
  }, [project, provider, projectId]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pt-20">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[calc(85vh-5rem)] mx-4 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
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
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Generate Your ERD
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
                This will analyze your entire project across all six dimensions
                and produce a comprehensive Experience Requirement Document
                with 14 structured sections.
              </p>
              <button
                onClick={generate}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Generate ERD
              </button>
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
    </div>
  );
}
