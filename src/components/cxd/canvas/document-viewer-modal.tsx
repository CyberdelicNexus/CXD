"use client";

import React, { useState, useRef, useEffect } from "react";
import { FreeformElement } from "@/types/canvas-elements";
import { X, Download, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToMarkdown, exportToPDF, exportToDOCX } from "@/lib/document-export";
import DOMPurify from "dompurify";

interface DocumentViewerModalProps {
  element: FreeformElement;
  onClose: () => void;
}

export function DocumentViewerModal({ element, onClose }: DocumentViewerModalProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const noteTitle = element.noteTitle || "Untitled Document";
  const noteBody = element.noteBody || "";
  const wordCount = element.wordCount || 0;

  // Convert HTML back to markdown for export
  const getMarkdownContent = () => {
    // Simple conversion - strip HTML tags for now
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = noteBody;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    return `# ${noteTitle}\n\n${textContent}`;
  };

  const handleExport = async (format: "md" | "pdf" | "docx" | "txt") => {
    const markdownContent = getMarkdownContent();
    const filename = noteTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();

    if (format === "md") {
      exportToMarkdown(markdownContent, filename);
    } else if (format === "pdf") {
      await exportToPDF(markdownContent, filename);
    } else if (format === "docx") {
      await exportToDOCX(markdownContent, filename);
    } else if (format === "txt") {
      const blob = new Blob([markdownContent], { type: "text/plain;charset=utf-8" });
      const { saveAs } = await import("file-saver");
      saveAs(blob, `${filename}.txt`);
    }

    setShowExportMenu(false);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  return (
    <div
      className="fixed inset-0 top-16 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[85vh] mx-4 bg-card/95 backdrop-blur-xl rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-b from-purple-500/10 to-transparent flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-3xl flex-shrink-0">{element.emoji || '📄'}</span>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">{noteTitle}</h2>
              <p className="text-xs text-muted-foreground">
                {wordCount} word{wordCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-foreground rounded-md transition-colors"
              >
                <Download className="w-3 h-3" />
                Export
                <ChevronDown className="w-3 h-3" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50">
                  <button
                    onClick={() => handleExport("pdf")}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-3"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      <span className="text-red-400">📕</span>
                    </div>
                    <span className="text-foreground">PDF</span>
                  </button>
                  <div className="h-px bg-border" />
                  <button
                    onClick={() => handleExport("docx")}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-3"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      <span className="text-blue-400">📘</span>
                    </div>
                    <span className="text-foreground">Word document</span>
                  </button>
                  <div className="h-px bg-border" />
                  <button
                    onClick={() => handleExport("md")}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-3"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      <span className="text-gray-400">📋</span>
                    </div>
                    <span className="text-foreground">Markdown</span>
                  </button>
                  <div className="h-px bg-border" />
                  <button
                    onClick={() => handleExport("txt")}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-3"
                  >
                    <div className="w-4 h-4 flex items-center justify-center">
                      <span className="text-gray-400">📄</span>
                    </div>
                    <span className="text-foreground">Plain text</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6" style={{ scrollbarWidth: "thin" }}>
          <div
            className="prose prose-invert prose-sm max-w-none text-foreground/90"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(noteBody, { USE_PROFILES: { html: true }, ADD_ATTR: ['target'] }) }}
          />
        </div>
      </div>
    </div>
  );
}
