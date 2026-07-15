"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-foreground mt-3 mb-1.5 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-foreground mt-3 mb-1 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-foreground/90 mt-2 mb-1 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-medium text-foreground/80 mt-1.5 mb-0.5 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground/80">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-4 mb-2 space-y-0.5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-4 mb-2 space-y-0.5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-sm leading-relaxed">{children}</li>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="text-xs font-mono whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{children}</code>
      );
    }
    return (
      <code className="px-1 py-0.5 rounded bg-white/10 text-xs font-mono text-primary/90">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-black/30 border border-border/30 rounded-lg p-3 mb-2 overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] last:mb-0">
      {children}
    </pre>
  ),
  hr: () => (
    <hr className="border-t border-border/40 my-3" />
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-foreground/70 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-hidden mb-2 last:mb-0">
      <table className="min-w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-border/40">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-2 py-1 text-left font-semibold text-foreground/80">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1 border-t border-border/20 text-foreground/70">{children}</td>
  ),
};

interface ChatMarkdownProps {
  content: string;
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

interface StreamingMarkdownProps {
  content: string;
  /** True only for the message currently being streamed. */
  streaming: boolean;
}

// Reveals streamed text at a steady rAF-driven rate so appended chunks
// materialize smoothly instead of jumping. The reveal accelerates as the
// buffer grows so it never lags far behind, and snaps to the full string the
// moment streaming stops — the final content is always shown exactly.
export function StreamingMarkdown({ content, streaming }: StreamingMarkdownProps) {
  const [revealed, setRevealed] = useState(streaming ? 0 : content.length);
  const contentRef = useRef(content);
  contentRef.current = content;
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;

  useEffect(() => {
    if (!streaming) {
      setRevealed(contentRef.current.length);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const full = contentRef.current.length;
      const cur = revealedRef.current;
      if (cur < full) {
        const behind = full - cur;
        // ~40 chars/s floor, accelerating with the backlog so it stays close.
        const perMs = Math.max(0.04, behind / 220);
        const next = Math.min(full, cur + Math.max(1, Math.ceil(perMs * (now - last))));
        revealedRef.current = next;
        setRevealed(next);
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [streaming]);

  const catchingUp = streaming && revealed < content.length;
  const text = streaming ? content.slice(0, revealed) : content;

  return (
    <div
      style={
        catchingUp
          ? {
              // Soften the growing bottom edge so new text eases in.
              WebkitMaskImage:
                "linear-gradient(to bottom, #000 calc(100% - 1em), rgba(0,0,0,0.45) 100%)",
              maskImage:
                "linear-gradient(to bottom, #000 calc(100% - 1em), rgba(0,0,0,0.45) 100%)",
            }
          : undefined
      }
    >
      <ChatMarkdown content={text} />
    </div>
  );
}
