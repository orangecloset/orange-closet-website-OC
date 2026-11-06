export function isEmptyHtml(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  const withoutTags = trimmed
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return withoutTags === "";
}
