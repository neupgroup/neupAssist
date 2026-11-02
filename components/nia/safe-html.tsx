/** Removes active content and scriptable URLs before rendering app supplied block HTML. */
export function sanitizeNiaHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|form|svg|math|template|base|meta|link)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|svg|math|template|base|meta|link)\b[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(?:src|href|xlink:href|formaction)\s*=\s*(["'])\s*(?:javascript|vbscript):[\s\S]*?\1/gi, "")
    .replace(/\s+(?:src|href|xlink:href|formaction)\s*=\s*(?:javascript|vbscript):[^\s>]*/gi, "")
    .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

/** Inserts sanitized HTML into an app block without interpreting it as Markdown. */
export function SafeNiaHtml({ html, className }: { html: string; className?: string }) {
  return <div className={`max-w-full overflow-x-auto [&>article]:box-border [&>article]:max-w-full [&>section]:box-border [&>section]:max-w-full [&>div]:box-border [&>div]:max-w-full [&_img]:max-w-full [&_img]:object-cover [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: sanitizeNiaHtml(html) }} />;
}
