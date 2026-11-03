import Link from "next/link";
import { Icon } from "../../ui-icon";

/** Explains how to call the Responses API and links to API key management. */
export default function ApiSettingsPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),900px)] py-[39px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),900px)] max-[760px]:pt-7 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[22px]">
        <div className="mb-6">
          <h1 className="m-0 text-[clamp(35px,4vw,47px)] font-medium tracking-[-.055em] text-foreground">API guide</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Send ordered system, developer, and user prompts to Nia through the Responses API.</p>
        </div>

        <section className="mb-4 rounded-xl border border-border bg-card p-5" aria-labelledby="responses-api-title">
          <h2 id="responses-api-title" className="m-0 text-base font-semibold text-foreground">Send a request</h2>
          <p className="mb-0 mt-1 text-sm text-muted-foreground">Authenticate with an API key in the <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">x-token</code> header.</p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6 text-foreground"><code>{`POST ${process.env.NEXT_PUBLIC_APP_URL ?? "https://neupgroup.com/assist"}/bridge/api.v1/responses
x-token: YOUR_API_KEY
Content-Type: application/json

{
  "model": "auto",
  "stream": false,
  "input": [
    { "type": "text", "role": "system", "text": "You are Nia, a personal assistant..." },
    { "type": "text", "role": "developer", "text": "Application-specific instructions..." },
    { "type": "text", "role": "user", "text": "Your prompt here" }
  ]
}`}</code></pre>
          <h3 className="mb-0 mt-5 text-sm font-semibold text-foreground">Success response</h3>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6 text-foreground"><code>{`{
  "success": true,
  "data": {
    "id": "resp_...",
    "createdAt": "2026-11-02T12:00:00.000Z",
    "output": [
      { "type": "text", "value": "The assistant's reply" }
    ]
  }
}`}</code></pre>
          <p className="mb-0 mt-3 text-sm leading-6 text-muted-foreground">Set <code>stream</code> to <code>true</code> to receive newline-delimited JSON events. Output events add text to <code>data.output</code>; the final event includes <code>data.done: true</code>.</p>
        </section>

        <div className="grid grid-cols-1 gap-3">
          <Link href="/settings/api/keys" className="group flex min-h-[88px] items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary"><Icon name="key" size={18} /></span>
            <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-foreground">API keys</strong><span className="mt-1 block text-sm text-muted-foreground">Create, view, and revoke keys for API requests.</span></span>
            <Icon name="arrow" size={15} className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
          <Link href="/settings/api/usage" className="group flex min-h-[88px] items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary"><Icon name="code" size={18} /></span>
            <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-foreground">API usage</strong><span className="mt-1 block text-sm text-muted-foreground">Review token counts and recorded request costs.</span></span>
            <Icon name="arrow" size={15} className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
