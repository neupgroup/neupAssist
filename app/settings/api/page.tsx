import Link from "next/link";
import { Icon } from "../../ui-icon";

/** Shows API configuration options available to this workspace. */
export default function ApiSettingsPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="relative z-[1] flex h-[61px] shrink-0 items-center justify-between border-b border-border/70 bg-background/75 px-[34px] shadow-[0_3px_12px_rgb(32_48_38_/_5%)] max-[760px]:px-5 max-[600px]:h-[53px] max-[600px]:px-[15px]">
        <div className="flex items-center gap-[9px] text-[14px] text-[#989f99]"><Link href="/settings" className="hover:text-[#4d5b50]">Settings</Link><span className="text-[#c4c9c3]">/</span><strong className="font-semibold text-[#3e4942]">API</strong></div>
        <span className="flex items-center gap-[5px] text-[14px] text-[#738b76]"><Icon name="key" size={14} /> API configuration</span>
      </header>

      <div className="mx-auto w-[min(calc(100%-60px),900px)] py-[39px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),900px)] max-[760px]:pt-7 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[22px]">
        <div className="mb-[27px]"><p className="mb-2 text-[12px] font-bold tracking-[.13em] text-[#77917a]">WORKSPACE CONFIGURATION</p><h1 className="m-0 text-4xl font-medium tracking-[-.055em] text-[#26332c]">API settings</h1><p className="mt-2 text-[15px] text-[#818b83]">Use your API key to send system, developer, and user prompts to Nia in order.</p></div>

        <section className="mb-4 rounded-xl border border-[#e6ebe4] bg-white p-[22px] max-[600px]:p-4" aria-labelledby="responses-api-title">
          <p className="mb-1 text-[11px] font-bold tracking-[.12em] text-[#77917a]">RESPONSES API</p>
          <h2 id="responses-api-title" className="m-0 text-lg font-semibold tracking-[-.02em] text-[#3d4941]">Send a request</h2>
          <p className="mt-[6px] text-[14px] leading-6 text-[#858f86]">The system prompt and persona from <code>prompts.json</code> are included by default. Set <code>x-token</code> to your API key; the endpoint appends your system, developer, and user input in that order and returns a completed JSON response.</p>
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
        </section>

        <div className="grid gap-4">
          <section className="rounded-xl border border-[#e6ebe4] bg-white p-[22px] max-[600px]:p-4" aria-labelledby="provider-keys-title">
            <div className="mb-4 flex items-start justify-between gap-4"><div><p className="mb-1 text-[11px] font-bold tracking-[.12em] text-[#77917a]">AI PROVIDERS</p><h2 id="provider-keys-title" className="m-0 text-lg font-semibold tracking-[-.02em] text-[#3d4941]">Provider API keys</h2><p className="mt-[6px] text-[14px] leading-6 text-[#858f86]">Connect credentials for providers such as OpenAI, Google, or OpenRouter. Secret values are protected and only a masked preview is shown after saving.</p></div><span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-[#edf3ec] text-[#66836b]"><Icon name="key" size={18} /></span></div>
            <Link href="/manage/keys" className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-[#52785e] px-[14px] text-[14px] font-medium text-white transition-colors hover:bg-[#456c52]">Manage provider keys <span aria-hidden="true">→</span></Link>
          </section>

          <section className="rounded-xl border border-[#e6ebe4] bg-white p-[22px] max-[600px]:p-4" aria-labelledby="integrations-title">
            <div className="mb-4 flex items-start justify-between gap-4"><div><p className="mb-1 text-[11px] font-bold tracking-[.12em] text-[#77917a]">CONNECTED APPS</p><h2 id="integrations-title" className="m-0 text-lg font-semibold tracking-[-.02em] text-[#3d4941]">API integrations</h2><p className="mt-[6px] text-[14px] leading-6 text-[#858f86]">Manage connected apps and their API access from the integrations workspace.</p></div><span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-[#edf3ec] text-[#66836b]"><Icon name="code" size={18} /></span></div>
            <Link href="/apps" className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#e2e8e0] px-[14px] text-[14px] font-medium text-[#566258] transition-colors hover:bg-[#f8faf8]">View apps and integrations <span aria-hidden="true">→</span></Link>
          </section>
        </div>
      </div>
    </section>
  );
}
