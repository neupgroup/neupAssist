import { SafeNiaHtml } from "./safe-html";

/** Renders the HTML payload supplied for a phone block. */
export function NiaPhone({ html }: { html: string }) {
  return <section className="nia-phone-block" aria-label="Phone information"><SafeNiaHtml html={html} /></section>;
}
