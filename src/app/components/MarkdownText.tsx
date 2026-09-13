import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={parts.length}>{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function parseTableRow(line: string): string[] | null {
  if (!line.trimStart().startsWith("|")) return null;
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export default function MarkdownText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let bullets: string[] = [];
  let paragraphs: string[] = [];
  let tableRows: string[][] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    nodes.push(
      <ul key={nodes.length} className="list-disc pl-5 space-y-1">
        {items.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ul>
    );
  };

  const flushParagraphs = () => {
    if (paragraphs.length === 0) return;
    const content = paragraphs;
    paragraphs = [];
    nodes.push(
      <p key={nodes.length} className="whitespace-pre-line">
        {content.map((line, i) => (
          <span key={i}>
            {renderInline(line)}
            {i < content.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const rows = tableRows;
    tableRows = [];
    nodes.push(
      <table key={nodes.length} className="border-collapse text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={j === 0 ? "py-1 pr-3 font-semibold text-gray-900 whitespace-nowrap" : "py-1 text-gray-600"}>
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const row = parseTableRow(line);
    if (row) {
      flushParagraphs();
      flushBullets();
      tableRows.push(row);
    } else if (/^\s*-\s+/.test(line)) {
      flushTable();
      flushParagraphs();
      bullets.push(line.replace(/^\s*-\s+/, ""));
    } else if (/^\s*#/.test(line)) {
      flushTable();
      flushParagraphs();
      flushBullets();
      nodes.push(
        <p key={nodes.length} className="font-bold">
          {renderInline(line.replace(/^\s*#\s*/, ""))}
        </p>
      );
    } else if (line.trim() === "") {
      flushTable();
      flushParagraphs();
      flushBullets();
    } else {
      flushTable();
      flushBullets();
      paragraphs.push(line);
    }
  }
  flushTable();
  flushParagraphs();
  flushBullets();

  return <div className="space-y-2">{nodes}</div>;
}
