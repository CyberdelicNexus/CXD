"use client";

import { useState, useCallback, useMemo } from "react";
import { X, FileText, Download, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCXDStore } from "@/store/cxd-store";
import { useAICredits } from "@/hooks/use-ai-credits";
import { getFullProjectContext } from "@/utils/ai-context-aggregator";
import { getERDPrompt } from "@/lib/ai/erd-prompt";
import { exportToMarkdown, exportToPDF, exportToDOCX } from "@/lib/document-export";
import type { AIProviderKey } from "@/types/ai-types";

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

  // Use the globally selected model from the credit meter, falling back to prop/default
  const { selectedModel } = useAICredits();
  const provider = providerProp || selectedModel || "gpt";

  const projects = useCXDStore((s) => s.projects);
  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );

  const projectName = project?.name || project?.intentionCore?.projectName || "Untitled";

  const generate = useCallback(async () => {
    if (!project) return;

    setIsGenerating(true);
    setError(null);
    setContent("");

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
      setContent(data.content || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate ERD");
    } finally {
      setIsGenerating(false);
    }
  }, [project, provider]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[85vh] mx-4 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
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
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">
                Generating your Experience Requirement Document...
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
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
            <div
              className={cn(
                "prose prose-invert prose-sm max-w-none",
                "prose-headings:text-foreground prose-p:text-foreground/80",
                "prose-strong:text-foreground prose-li:text-foreground/80",
                "prose-hr:border-border/50",
              )}
            >
              {/* Simple markdown rendering: split on headings, render as styled HTML */}
              {content.split("\n").map((line, i) => {
                if (line.startsWith("# ")) {
                  return (
                    <h1 key={i} className="text-xl font-bold mt-6 mb-3 text-foreground">
                      {line.replace(/^# /, "")}
                    </h1>
                  );
                }
                if (line.startsWith("## ")) {
                  return (
                    <h2 key={i} className="text-lg font-semibold mt-5 mb-2 text-foreground border-b border-border/30 pb-1">
                      {line.replace(/^## /, "")}
                    </h2>
                  );
                }
                if (line.startsWith("### ")) {
                  return (
                    <h3 key={i} className="text-base font-medium mt-4 mb-1.5 text-foreground">
                      {line.replace(/^### /, "")}
                    </h3>
                  );
                }
                if (line.startsWith("---")) {
                  return <hr key={i} className="my-4 border-border/40" />;
                }
                if (line.startsWith("- ") || line.startsWith("* ")) {
                  return (
                    <li key={i} className="text-sm text-foreground/80 ml-4 list-disc">
                      {line.replace(/^[-*] /, "")}
                    </li>
                  );
                }
                if (line.trim() === "") {
                  return <div key={i} className="h-2" />;
                }
                return (
                  <p key={i} className="text-sm text-foreground/80 leading-relaxed mb-1">
                    {line}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
