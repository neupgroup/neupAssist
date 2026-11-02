import { SafeNiaHtml } from "./safe-html";

/** Renders the HTML payload supplied for a lead block. */
export function NiaLead({ html }: { html: string }) {
  return <article className="nia-lead-block"><SafeNiaHtml html={html} /></article>;
}
