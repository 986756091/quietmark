import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), ["className"]],
    span: [...(defaultSchema.attributes?.span || []), ["className"]],
    div: [...(defaultSchema.attributes?.div || []), ["className"]],
    input: [
      ...(defaultSchema.attributes?.input || []),
      ["type"],
      ["checked"],
      ["disabled"]
    ],
    a: [
      ...(defaultSchema.attributes?.a || []),
      ["target"],
      ["rel"]
    ]
  }
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, schema)
  .use(rehypeHighlight)
  .use(rehypeStringify);

export async function renderMarkdown(markdown) {
  const file = await processor.process(markdown);
  return String(file);
}

export function extractOutline(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line, index) => {
      const match = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line.trim());
      if (!match) {
        return null;
      }

      return {
        id: `heading-${index}`,
        level: match[1].length,
        title: match[2].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`~]/g, ""),
        line: index
      };
    })
    .filter(Boolean);
}

export function documentTitle(markdown, fallback = "Untitled") {
  const heading = extractOutline(markdown).find((item) => item.level === 1);
  return heading?.title || fallback;
}

export function buildExportHtml({ body, title, theme }) {
  const background = theme === "dark" ? "#1f211f" : "#f8f5ee";
  const foreground = theme === "dark" ? "#ede8df" : "#242320";
  const muted = theme === "dark" ? "#aaa397" : "#6d6860";
  const border = theme === "dark" ? "#3c3b36" : "#ded8cb";
  const code = theme === "dark" ? "#282b28" : "#f0ebe2";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: ${theme}; }
      body {
        margin: 0;
        background: ${background};
        color: ${foreground};
        font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
        line-height: 1.72;
      }
      main {
        max-width: 760px;
        margin: 0 auto;
        padding: 72px 34px 96px;
      }
      h1, h2, h3, h4, h5, h6 {
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.2;
        margin: 2.1em 0 .75em;
      }
      h1 { font-size: 2.4rem; margin-top: 0; }
      h2 { font-size: 1.7rem; border-bottom: 1px solid ${border}; padding-bottom: .35em; }
      p, ul, ol, blockquote, table, pre { margin: 1em 0; }
      a { color: inherit; text-decoration-color: ${muted}; text-underline-offset: .2em; }
      blockquote { border-left: 3px solid ${border}; color: ${muted}; padding-left: 1em; }
      code { background: ${code}; border-radius: 5px; padding: .13em .35em; font-family: "SFMono-Regular", Menlo, monospace; font-size: .9em; }
      pre { background: ${code}; border-radius: 8px; overflow: auto; padding: 1em; }
      pre code { background: transparent; padding: 0; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid ${border}; padding: .45em .6em; }
      img { max-width: 100%; border-radius: 7px; }
      hr { border: 0; border-top: 1px solid ${border}; margin: 2em 0; }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
