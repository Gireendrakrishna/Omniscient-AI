import React from "react";

interface Props {
  content: string;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  // Tokenize links [label](url), bold **text**, and inline code `code`
  const tokenRegex = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m) {
        return (
          <a
            key={idx}
            href={m[2]}
            target="_blank"
            rel="noreferrer"
            className="text-[#D4AF37] underline hover:text-[#FFFFFF] font-medium transition-colors"
          >
            {m[1]}
          </a>
        );
      }
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#FFFFFF]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-[#0A0A0A] border border-[#D4AF37]/30 text-[#D4AF37] font-mono text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderMarkdownBlocks(blockText: string): React.ReactNode[] {
  const lines = blockText.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={`sp-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    // Horizontal Rule ---
    if (/^---+$/.test(trimmed)) {
      elements.push(
        <hr key={`hr-${i}`} className="my-4 border-t border-[#D4AF37]/25" />
      );
      i++;
      continue;
    }

    // Markdown Table Detection (| Col1 | Col2 |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (rowStr: string) =>
          rowStr
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());

        const headers = parseRow(tableLines[0]);
        const isSeparator = (rowStr: string) => /^[\s|:-]+$/.test(rowStr);
        const bodyRows = tableLines
          .slice(1)
          .filter((r) => !isSeparator(r))
          .map(parseRow);

        elements.push(
          <div
            key={`tbl-${i}`}
            className="my-3 overflow-x-auto rounded-lg border border-[#D4AF37]/30 bg-[#0A0A0A]"
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#111111] border-b border-[#D4AF37]/30 text-[#D4AF37]">
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="py-2.5 px-3.5 font-semibold">
                      {renderInlineFormatting(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4AF37]/15">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#111111]/60">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2.5 px-3.5 text-[#BDBDBD] align-top">
                        {renderInlineFormatting(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-base font-bold text-[#D4AF37] pt-2">
          {renderInlineFormatting(trimmed.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-lg font-bold text-[#FFFFFF] pt-3">
          {renderInlineFormatting(trimmed.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-xl font-bold text-[#D4AF37] pt-3">
          {renderInlineFormatting(trimmed.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    // Bullet points
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={`li-${i}`} className="flex items-start gap-2.5 pl-2 text-[#BDBDBD]">
          <span className="text-[#D4AF37] mt-0.5">•</span>
          <span className="text-[#FFFFFF]">{renderInlineFormatting(trimmed.slice(2))}</span>
        </div>
      );
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote
          key={`bq-${i}`}
          className="border-l-2 border-[#D4AF37] pl-3.5 py-1.5 italic text-[#BDBDBD] bg-[#0A0A0A] rounded-r"
        >
          {renderInlineFormatting(trimmed.slice(2))}
        </blockquote>
      );
      i++;
      continue;
    }

    // Standard Paragraph
    elements.push(
      <p key={`p-${i}`} className="text-[#BDBDBD] leading-relaxed">
        {renderInlineFormatting(line)}
      </p>
    );
    i++;
  }

  return elements;
}

export const MarkdownRenderer: React.FC<Props> = ({ content }) => {
  if (!content) return null;

  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-[#FFFFFF]">
      {parts.map((part, idx) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const lines = part.slice(3, -3).trim().split("\n");
          const firstLine = lines[0]?.trim() || "";
          const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : "code";
          const codeBody = hasLang ? lines.slice(1).join("\n") : lines.join("\n");
          return (
            <div
              key={idx}
              className="my-3 rounded-lg border border-[#D4AF37]/30 bg-[#0A0A0A] overflow-hidden"
            >
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#111111] border-b border-[#D4AF37]/25 text-xs text-[#D4AF37] font-mono">
                <span>{lang.toUpperCase()}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(codeBody)}
                  className="text-[#BDBDBD] hover:text-[#FFFFFF] transition-colors"
                >
                  Copy Code
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto text-xs font-mono text-[#FFFFFF] leading-relaxed">
                <code>{codeBody}</code>
              </pre>
            </div>
          );
        }

        return <div key={idx} className="space-y-1.5">{renderMarkdownBlocks(part)}</div>;
      })}
    </div>
  );
};
