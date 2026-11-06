import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { isHtml } from "../../lib/richText";

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeStringify);

export function legalMarkdownToHtml(value: string): string {
  if (isHtml(value)) return value;
  return markdownProcessor.processSync(value).toString();
}
