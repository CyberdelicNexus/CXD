"use client";

import React from "react";
import { CanvasElement } from "@/types/canvas-elements";
import { X, ExternalLink, MapPin, FileText, Image as ImageIcon, Video, Link2, Box } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickViewModalProps {
  element: CanvasElement;
  onClose: () => void;
  onNavigateToCanvas: () => void;
}

export function QuickViewModal({ element, onClose, onNavigateToCanvas }: QuickViewModalProps) {
  // Extract content based on element type
  const renderContent = () => {
    switch (element.type) {
      case "text":
      case "freeform": {
        const content = (element as any).content || "";
        return (
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 leading-relaxed">
              {content || <span className="italic text-muted-foreground">No content</span>}
            </pre>
          </div>
        );
      }

      case "image": {
        const src = (element as any).src || (element as any).url;
        const alt = (element as any).alt || "Image";
        return (
          <div className="flex flex-col items-center gap-4">
            {src ? (
              <img
                src={src}
                alt={alt}
                className="max-w-full max-h-[60vh] rounded-lg border border-border/50"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="flex items-center justify-center w-full h-64 bg-muted/20 rounded-lg border border-dashed border-border/50">
                <div className="text-center">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No image source</p>
                </div>
              </div>
            )}
            {alt && <p className="text-sm text-muted-foreground text-center">{alt}</p>}
          </div>
        );
      }

      case "link": {
        const url = (element as any).url || "";
        const title = (element as any).title || "";
        const description = (element as any).description || "";
        
        return (
          <div className="space-y-4">
            {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
            {url && (
              <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg border border-border/50">
                <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline truncate"
                >
                  {url}
                </a>
                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-auto" />
              </div>
            )}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open Link
              </a>
            )}
          </div>
        );
      }

      case "container": {
        const title = (element as any).title || (element as any).name || "Untitled";
        const childCount = (element as any).children?.length || 0;
        
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Box className="w-8 h-8 text-primary" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">
                  Container • {childCount} {childCount === 1 ? "item" : "items"}
                </p>
              </div>
            </div>
            <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground">
                This container contains {childCount} element{childCount === 1 ? "" : "s"}. 
                View on canvas to see its contents.
              </p>
            </div>
          </div>
        );
      }

      case "board": {
        const title = (element as any).title || "Untitled Board";
        const boardId = (element as any).childBoardId;
        
        // Get board data from global project reference (set by hypercube-3d)
        const project = (window as any).__currentProject;
        // Count elements by filtering canvasElements where boardId matches
        const allElements = project?.canvasLayout?.elements || [];
        const boardElements = allElements.filter((el: any) => 
          el.boardId === boardId && el.type !== 'line' && el.type !== 'connector'
        );
        const childCount = boardElements.length;
        
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Box className="w-8 h-8 text-primary" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">
                  Board • {childCount} {childCount === 1 ? "item" : "items"}
                </p>
              </div>
            </div>
            <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground">
                This board contains {childCount} element{childCount === 1 ? "" : "s"}. 
                View on canvas to see its contents.
              </p>
            </div>
          </div>
        );
      }

      case "experienceBlock": {
        const title = (element as any).title || "Experience Block";
        const description = (element as any).description || "";
        
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            {description && (
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {description}
              </p>
            )}
          </div>
        );
      }

      default:
        return (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground italic">Preview not available for this element type</p>
          </div>
        );
    }
  };

  // Get element title
  const getTitle = () => {
    switch (element.type) {
      case "text":
      case "freeform": {
        const content = (element as any).content || "";
        const firstLine = content.split("\n")[0];
        return firstLine?.slice(0, 60) || "Text Card";
      }
      case "link":
        return (element as any).title || (element as any).url?.slice(0, 60) || "Link";
      case "image":
        return (element as any).alt || "Image";
      case "container":
        return (element as any).title || "Container";
      case "board":
        return (element as any).name || "Board";
      case "experienceBlock":
        return (element as any).title || "Experience Block";
      default:
        return "Element";
    }
  };

  const getIcon = () => {
    switch (element.type) {
      case "text":
      case "freeform":
        return FileText;
      case "image":
        return ImageIcon;
      case "link":
        return Link2;
      case "container":
      case "board":
        return Box;
      default:
        return Box;
    }
  };

  const Icon = getIcon();
  const title = getTitle();

  return (
    <div 
      className="fixed inset-0 top-16 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] mx-4 bg-card/95 backdrop-blur-xl rounded-xl border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-border bg-gradient-to-b from-purple-500/10 to-transparent">
          <Icon className="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">{title}</h2>
            <p className="text-xs text-muted-foreground capitalize">{element.type}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
          {renderContent()}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg hover:bg-white/10 text-foreground/80 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              onNavigateToCanvas();
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
          >
            <MapPin className="w-4 h-4" />
            View on Canvas
          </button>
        </div>
      </div>
    </div>
  );
}
