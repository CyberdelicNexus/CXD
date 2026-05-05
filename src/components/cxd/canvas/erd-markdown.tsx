"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const erdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-foreground mt-6 mb-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-foreground mt-6 mb-2 border-b border-border/30 pb-1 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-medium text-foreground mt-4 mb-1.5 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-medium text-foreground/90 mt-3 mb-1 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-sm text-foreground/80 leading-relaxed mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground/70">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-5 mb-3 space-y-1 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-5 mb-3 space-y-1 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-sm text-foreground/80 leading-relaxed">{children}</li>
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
        <code className="text-xs font-mono whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {children}
        </code>
      );
    }
    return (
      <code className="px-1 py-0.5 rounded bg-white/10 text-xs font-mono text-primary/90">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-black/30 border border-border/30 rounded-lg p-3 mb-3 overflow-x-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] last:mb-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="border-t border-border/40 my-5" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 my-3 text-foreground/70 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3 last:mb-0 rounded-lg border border-border/30">
      <table className="min-w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-white/[0.03] border-b border-border/40">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-foreground/80 text-xs">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-t border-border/20 text-foreground/70 text-xs">{children}</td>
  ),
};

interface ERDMarkdownProps {
  content: string;
}

export function ERDMarkdown({ content }: ERDMarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={erdComponents}>
      {content}
    </ReactMarkdown>
  );
}
