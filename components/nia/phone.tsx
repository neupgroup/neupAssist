import { SafeNiaHtml } from "./safe-html";

/** Renders the HTML payload supplied for a phone block. */
export function NiaPhone({ html }: { html: string }) {
  return <section className="mb-3 w-full max-w-[460px] overflow-hidden rounded-xl border border-border bg-card px-[14px] py-3" aria-label="Phone information"><SafeNiaHtml html={html} /></section>;
}
