import { useMemo } from "react";
import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "blockquote",
  "pre",
  "code",
  "hr",
  "a",
];

const ALLOWED_ATTR = ["href", "title", "target", "rel", "colspan", "rowspan"];

export default function RichText({ html, className = "rich-content" }: { html: string; className?: string }) {
  const clean = useMemo(
    () => DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR }),
    [html]
  );
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
