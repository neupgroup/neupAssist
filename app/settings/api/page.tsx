import Link from "next/link";
import { Icon } from "../../ui-icon";

/** Shows API configuration options available to this workspace. */
export default function ApiSettingsPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">

      <div className="mx-auto w-[min(calc(100%-60px),900px)] pt-[56px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),900px)] max-[760px]:pt-10 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[34px]">
        <div className="mb-[27px]"><h1 className="m-0 text-4xl font-medium tracking-[-.055em] text-[#26332c]">API settings</h1><p className="mt-2 text-[15px] text-[#818b83]">Use your API key to send system, developer, and user prompts to Nia in order.</p></div>

        <section className="mb-4 rounded-xl border border-[#e6ebe4] bg-white p-[22px] max-[600px]:p-4" aria-labelledby="responses-api-title">
          
          <h2 id="responses-api-title" className="m-0 text-lg font-semibold tracking-[-.02em] text-[#3d4941]">Send a request</h2>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-[#f6f8f5] p-4 text-[12px] leading-6 text-[#46524a]"><code>{`POST /bridge/api.v1/responses
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
          <h3 className="mb-0 mt-5 text-sm font-semibold text-[#3d4941]">Success response</h3>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[#f6f8f5] p-4 text-[12px] leading-6 text-[#46524a]"><code>{`{
  "success": true,
  "data": {
    "id": "resp_...",
    "createdAt": "2026-11-02T12:00:00.000Z",
    "output": [
      { "type": "text", "value": "The assistant's reply" }
    ]
  }
}`}</code></pre>
          <p className="mb-0 mt-3 text-[13px] leading-5 text-[#858f86]">Set <code>stream</code> to <code>true</code> to receive newline-delimited JSON events. Each output event adds text entities to <code>data.output</code>; the final event has <code>data.done: true</code>.</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[#f6f8f5] p-4 text-[12px] leading-6 text-[#46524a]"><code>{`{"success":true,"data":{"id":"resp_...","output":[{"type":"text","value":"Hello"}]}}
{"success":true,"data":{"id":"resp_...","output":[{"type":"text","value":" there!"}]}}
{"success":true,"data":{"id":"resp_...","done":true}}`}</code></pre>
          <p className="mb-0 mt-3 text-[13px] leading-5 text-[#858f86]">Errors use the same app-owned envelope: <code>{'{ "success": false, "error": { "code": "...", "description": "..." } }'}</code>.</p>
        </section>

        <div className="grid gap-4">
          <section className="rounded-xl border border-[#e6ebe4] bg-white p-[22px] max-[600px]:p-4" aria-labelledby="provider-keys-title">
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 id="provider-keys-title" className="m-0 text-lg font-semibold tracking-[-.02em] text-[#3d4941]">Provider API keys</h2><p className="mt-[6px] text-[14px] leading-6 text-[#858f86]">Connect credentials for providers such as OpenAI, Google, or OpenRouter. Secret values are protected and only a masked preview is shown after saving.</p></div><span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-[#edf3ec] text-[#66836b]"><Icon name="key" size={18} /></span></div>
            <Link href="/settings/keys" className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-[#52785e] px-[14px] text-[14px] font-medium text-white transition-colors hover:bg-[#456c52]">Manage provider keys <Icon name="arrowRight" size={16} /></Link>
          </section>

          <section className="rounded-xl border border-[#e6ebe4] bg-white p-[22px] max-[600px]:p-4" aria-labelledby="integrations-title">
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 id="integrations-title" className="m-0 text-lg font-semibold tracking-[-.02em] text-[#3d4941]">API integrations</h2><p className="mt-[6px] text-[14px] leading-6 text-[#858f86]">Manage connected apps and their API access from the integrations workspace.</p></div><span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-[#edf3ec] text-[#66836b]"><Icon name="code" size={18} /></span></div>
            <Link href="/settings/applications" className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#e2e8e0] px-[14px] text-[14px] font-medium text-[#566258] transition-colors hover:bg-[#f8faf8]">View apps and integrations <Icon name="arrowRight" size={16} /></Link>
          </section>
        </div>
      </div>
    </section>
  );
}
