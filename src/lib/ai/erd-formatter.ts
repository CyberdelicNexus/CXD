/**
 * ERD Markdown Formatter
 *
 * Deterministic post-processor that cleans up raw AI-generated ERD text.
 * Fixes common formatting issues: escaped markdown, concatenated lines,
 * collapsed tables, inline headings, etc.
 *
 * Rules applied in order:
 * 1. Un-escape markdown characters
 * 2. Split concatenated lines (headings, bullets, table rows, field labels)
 * 3. Normalize spacing around headings, tables, code blocks, HRs
 * 4. Fix corrupted arrows and special characters
 */

export function formatERDMarkdown(raw: string): string {
  let text = raw;

  // ── Pass 1: Un-escape markdown characters ───────────────────────────
  // \| → |   \*\* → **   \* → *   \` → `   \> → >   \[ → [   \] → ]
  text = text.replace(/\\\|/g, "|");
  text = text.replace(/\\\*\\\*/g, "**");
  text = text.replace(/\\\*/g, "*");
  text = text.replace(/\\`/g, "`");
  text = text.replace(/\\>/g, ">");
  text = text.replace(/\\\[/g, "[");
  text = text.replace(/\\\]/g, "]");

  // ── Pass 2: Split concatenated structures ───────────────────────────

  // 2a. Headings that are stuck to preceding text:
  //     "some text## 3. Section" → "some text\n\n## 3. Section"
  text = text.replace(/([^\n])(#{1,3}\s)/g, "$1\n\n$2");

  // 2b. Headings that are stuck to following text:
  //     "## 3. Section**Bold text" → "## 3. Section\n\n**Bold text"
  text = text.replace(/(^#{1,3}\s.+?)(\*\*[A-Z])/gm, "$1\n\n$2");

  // 2c. Bold labels that start a new field concatenated to previous content:
  //     "...end of sentence.**Next Label:** value" → "...end of sentence.\n- **Next Label:** value"
  text = text.replace(
    /([.!?:;)\]])\s*(\*\*[A-Z][^*]+:\*\*)/g,
    "$1\n$2",
  );

  // 2d. Table rows collapsed into a single line:
  //     "| A | B || C | D |" → "| A | B |\n| C | D |"
  //     Detect: | ... | immediately followed by | without newline
  text = text.replace(/\|\s*\n?\s*\|/g, (match) => {
    // Only split if there's no newline already
    if (match.includes("\n")) return match;
    return "|\n|";
  });

  // 2e. Bullet items concatenated on one line:
  //     "- Item one- Item two" → "- Item one\n- Item two"
  text = text.replace(/([^\n])(\n?- )/g, (match, before, bullet) => {
    if (match.startsWith("\n")) return match;
    return `${before}\n${bullet}`;
  });

  // 2f. Numbered list items concatenated:
  //     "1. First2. Second" → "1. First\n2. Second"
  text = text.replace(/([^\n])(\d+\.\s)/g, "$1\n$2");

  // ── Pass 3: Normalize spacing ───────────────────────────────────────

  const lines = text.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const prev = result.length > 0 ? result[result.length - 1].trim() : "";

    // Ensure blank line before headings
    if (/^#{1,3}\s/.test(trimmed) && prev !== "" && prev !== "---") {
      if (result.length > 0 && result[result.length - 1].trim() !== "") {
        result.push("");
      }
    }

    result.push(line);

    // Ensure blank line after headings
    if (/^#{1,3}\s/.test(trimmed)) {
      const next = i + 1 < lines.length ? lines[i + 1]?.trim() : "";
      if (next !== "" && next !== undefined) {
        result.push("");
      }
    }

    // Ensure blank line before/after horizontal rules
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      const next = i + 1 < lines.length ? lines[i + 1]?.trim() : "";
      if (next !== "" && next !== undefined) {
        result.push("");
      }
    }

    // Ensure blank line before table start (line starting with |)
    if (/^\|/.test(trimmed) && prev !== "" && !/^\|/.test(prev)) {
      // Insert blank line before the table row we just added
      result.splice(result.length - 1, 0, "");
    }

    // Ensure blank line after table end (current is table row, next is not)
    if (/^\|/.test(trimmed)) {
      const next = i + 1 < lines.length ? lines[i + 1]?.trim() : "";
      if (next !== undefined && next !== "" && !/^\|/.test(next)) {
        result.push("");
      }
    }

    // Ensure blank line before/after code fences
    if (/^```/.test(trimmed)) {
      const next = i + 1 < lines.length ? lines[i + 1]?.trim() : "";
      if (next !== "" && next !== undefined && !/^```/.test(next)) {
        // Don't add blank after opening fence
      }
    }
  }

  text = result.join("\n");

  // ── Pass 4: Fix corrupted special characters ────────────────────────

  // Corrupted arrows: !' or â†' → →
  text = text.replace(/[!â€™â]†'/g, "→");
  text = text.replace(/→/g, "→"); // Already correct, no-op safety

  // Collapse excessive blank lines (3+ → 2)
  text = text.replace(/\n{4,}/g, "\n\n\n");

  // Trim leading/trailing whitespace
  text = text.trim();

  return text;
}
