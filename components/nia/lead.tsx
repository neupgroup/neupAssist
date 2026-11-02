import { SafeNiaHtml } from "./safe-html";

/** Renders the HTML payload supplied for a lead block. */
export function NiaLead({ html }: { html: string }) {
  return <article className="mb-3 w-full max-w-[460px] overflow-hidden rounded-xl border border-border bg-card p-[13px]"><SafeNiaHtml html={html} /></article>;
}
