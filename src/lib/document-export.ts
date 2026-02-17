"use client";

import { saveAs } from "file-saver";

/**
 * Export content as a Markdown file.
 */
export function exportToMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  saveAs(blob, filename.endsWith(".md") ? filename : `${filename}.md`);
}

/**
 * Export content as a PDF file using jspdf.
 * Uses a simple text-based approach for Markdown content.
 */
export async function exportToPDF(content: string, filename: string): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 6;
  let y = margin;

  // Simple Markdown to PDF rendering
  const lines = content.split("\n");

  for (const line of lines) {
    // Check for page break
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }

    if (line.startsWith("# ")) {
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      y += 4;
      const text = line.replace(/^# /, "");
      doc.text(text, margin, y);
      y += lineHeight + 4;
    } else if (line.startsWith("## ")) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      y += 3;
      const text = line.replace(/^## /, "");
      doc.text(text, margin, y);
      y += lineHeight + 2;
    } else if (line.startsWith("### ")) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      y += 2;
      const text = line.replace(/^### /, "");
      doc.text(text, margin, y);
      y += lineHeight + 1;
    } else if (line.startsWith("---")) {
      y += 2;
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
    } else if (line.trim() === "") {
      y += lineHeight * 0.5;
    } else {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      // Strip basic Markdown formatting for PDF
      const cleanText = line
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`(.*?)`/g, "$1");

      // Handle bullet points
      const indent = line.startsWith("- ") || line.startsWith("* ") ? 4 : 0;
      const textContent = indent > 0 ? cleanText.replace(/^[-*] /, "") : cleanText;
      const prefix = indent > 0 ? "\u2022 " : "";

      const wrapped = doc.splitTextToSize(prefix + textContent, maxWidth - indent);
      for (const wrappedLine of wrapped) {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(wrappedLine, margin + indent, y);
        y += lineHeight;
      }
    }
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/**
 * Export content as a DOCX file using the docx package.
 */
export async function exportToDOCX(content: string, filename: string): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

  const paragraphs: InstanceType<typeof Paragraph>[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    if (line.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^# /, ""),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
      );
    } else if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^## /, ""),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        }),
      );
    } else if (line.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^### /, ""),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        }),
      );
    } else if (line.startsWith("---")) {
      paragraphs.push(
        new Paragraph({
          children: [],
          spacing: { before: 200, after: 200 },
          border: {
            bottom: { style: "single" as any, size: 1, color: "CCCCCC" },
          },
        }),
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const text = line.replace(/^[-*] /, "");
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text })],
          bullet: { level: 0 },
        }),
      );
    } else if (line.trim() === "") {
      paragraphs.push(new Paragraph({ children: [] }));
    } else {
      // Handle bold and italic markdown
      const runs: InstanceType<typeof TextRun>[] = [];
      const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/);
      for (const part of parts) {
        if (part.startsWith("**") && part.endsWith("**")) {
          runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
        } else if (part.startsWith("*") && part.endsWith("*")) {
          runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
        } else {
          runs.push(new TextRun({ text: part }));
        }
      }
      paragraphs.push(new Paragraph({ children: runs }));
    }
  }

  const doc = new Document({
    sections: [
      {
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename.endsWith(".docx") ? filename : `${filename}.docx`);
}
