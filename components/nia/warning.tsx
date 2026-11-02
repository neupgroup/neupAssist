import { SafeNiaHtml } from "./safe-html";

/** Renders the HTML payload supplied for a warning block. */
export function NiaWarning({ html }: { html: string }) {
  return <aside className="nia-warning-block" role="note" aria-label="Warning"><span className="nia-warning-icon" aria-hidden="true">!</span><SafeNiaHtml html={html} /></aside>;
}
