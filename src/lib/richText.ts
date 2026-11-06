const HTML_TAG_RE =
  /^\s*<(?:p|h[1-6]|ul|ol|li|table|thead|tbody|tfoot|tr|td|th|strong|b|em|i|u|s|blockquote|pre|code|br|hr|div|a)\b/i;

export function isHtml(value: string): boolean {
  return HTML_TAG_RE.test(value);
}

export function isEmptyHtml(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  if (!isHtml(trimmed)) return false;
  const withoutTags = trimmed
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return withoutTags === "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function parseTableRow(line: string): string[] | null {
  if (!line.trimStart().startsWith("|")) return null;
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function legacyMarkdownToHtml(text: string): string {
  const out: string[] = [];
  let bullets: string[] = [];
  let paragraphs: string[] = [];
  let tableRows: string[][] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    out.push(`<ul>${bullets.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    bullets = [];
  };

  const flushParagraphs = () => {
    if (paragraphs.length === 0) return;
    out.push(`<p>${paragraphs.join("<br>")}</p>`);
    paragraphs = [];
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const rows = tableRows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
      .join("");
    out.push(`<table><tbody>${rows}</tbody></table>`);
    tableRows = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const row = parseTableRow(line);
    if (row) {
      flushParagraphs();
      flushBullets();
      tableRows.push(row.map((cell) => renderInline(cell)));
    } else if (/^\s*-\s+/.test(line)) {
      flushTable();
      flushParagraphs();
      bullets.push(renderInline(line.replace(/^\s*-\s+/, "")));
    } else if (/^\s*#/.test(line)) {
      flushTable();
      flushParagraphs();
      flushBullets();
      out.push(`<h2>${renderInline(line.replace(/^\s*#\s*/, ""))}</h2>`);
    } else if (line.trim() === "") {
      flushTable();
      flushParagraphs();
      flushBullets();
    } else {
      flushTable();
      flushBullets();
      paragraphs.push(renderInline(line));
    }
  }

  flushTable();
  flushParagraphs();
  flushBullets();
  return out.join("");
}

export function toEditorHtml(value: string): string {
  return isHtml(value) ? value : legacyMarkdownToHtml(value);
}
