import { SafeNiaHtml } from "./safe-html";
import { Icon } from "@/app/ui-icon";

/** Renders the HTML payload supplied for a warning block. */
export function NiaWarning({ html }: { html: string }) {
  return <aside className="mb-3 flex w-full max-w-[560px] items-start gap-[10px] rounded-[10px] border border-warning/25 bg-warning/5 px-[14px] py-3 text-warning" role="note" aria-label="Warning"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-warning/10" aria-hidden="true"><Icon name="alert" size={14} /></span><div className="min-w-0"><SafeNiaHtml html={html} /></div></aside>;
}
