import { marked } from "marked";
import { useMemo } from "react";

// Configure marked once: GFM + line breaks
marked.use({ gfm: true, breaks: true });

type MarkdownPreviewProps = {
  content: string;
};

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    if (!content.trim()) return "";
    try {
      return marked.parse(content, { async: false }) as string;
    } catch {
      return `<pre>${content}</pre>`;
    }
  }, [content]);

  if (!html) {
    return (
      <div className="prose md-body" style={{ color: "var(--text-3)", fontStyle: "italic" }}>
        Nothing to preview.
      </div>
    );
  }

  return (
    <div
      className="prose md-body"
      /* Content is user-authored (not third-party) — XSS risk is accepted */
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
