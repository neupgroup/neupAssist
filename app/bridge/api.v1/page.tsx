"use client";

import { useState } from "react";
import { Button } from "@neup/components/ui/button";
import { Link } from "@neup/components/ui/link";
import { Icon } from "../ui-icon";

const example = `curl https://api.nia.neupgroup.com/v1/chat/completions \\
  -H "Authorization: Bearer $NIA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "nia-assistant",
    "messages": [{ "role": "user", "content": "Hello, Nia" }]
  }'`;

export default function ApiPage() {
  const [copied, setCopied] = useState(false);
  async function copyExample() { await navigator.clipboard.writeText(example); setCopied(true); setTimeout(() => setCopied(false), 1800); }
  return <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
    <header className="relative z-[1] flex h-[61px] shrink-0 items-center justify-between border-b border-border/70 bg-background/75 px-[34px] shadow-[0_3px_12px_rgb(32_48_38_/_5%)] max-[760px]:px-5 max-[600px]:h-[53px] max-[600px]:px-[15px]">
      <div className="flex items-center gap-[9px] text-[14px] text-[#989f99]"><span>Workspace</span><span className="text-[#c4c9c3]">/</span><strong className="font-semibold text-[#3e4942]">API</strong></div>
      <Link href="https://github.com/neupgroup/neup.cloud" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[14px] text-[#738177] hover:text-[#365e45]">API setup guide <Icon name="arrow" size={15} /></Link>
    </header>
    <div className="mx-auto w-[min(calc(100%-60px),930px)] py-[39px] pb-[30px] max-[760px]:w-[min(calc(100%-40px),930px)] max-[760px]:pt-7 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[22px]">
      <div className="mb-[27px]"><div className="mb-5 grid h-[37px] w-[37px] place-items-center rounded-[11px] border border-[#e4eae2] bg-white text-[#67866d]"><Icon name="code" size={19} /></div><p className="mb-2 text-[12px] font-bold tracking-[.13em] text-[#77917a]">DEVELOPER ACCESS</p><h1 className="m-0 text-4xl font-medium tracking-[-.055em] text-[#26332c]">Nia API</h1><p className="mt-[9px] max-w-[560px] text-[15px] leading-[1.7] text-[#818b83]">Bring Nia into your own tools and workflows. One API, built around the way you work.</p></div>
      <div className="mb-[15px] flex items-center justify-between rounded-[11px] border border-[#e6ebe4] bg-white px-[15px] py-3"><div className="flex items-center gap-[10px]"><span className="h-[6px] w-[6px] rounded-full bg-[#b7c0b8]" /><div className="grid gap-[3px]"><strong className="text-[14px] font-semibold text-[#465349]">API access</strong><span className="text-[14px] text-[#858f86]">Service connection needed</span></div></div><Button variant="outlined" className="!h-[38px] !rounded-lg !text-[14px]" disabled title="API key management will be available when Nia’s API is connected"><Icon name="key" size={15} /> Create API key</Button></div>
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(240px,.9fr)] gap-[14px] max-[600px]:grid-cols-1">
        <article className="rounded-xl border border-[#e6ebe4] bg-white p-[18px]"><div className="flex items-start justify-between"><div><span className="text-[12px] font-bold tracking-[.1em] text-[#7c8c7e]">GET STARTED</span><h2 className="mt-[7px] text-base font-semibold tracking-[-.025em] text-[#3c4940]">Make your first request</h2></div><span className="rounded-[5px] bg-[#edf4ec] px-[7px] py-1 font-mono text-xs font-bold text-[#5b8062]">POST</span></div><div className="mt-[19px] grid gap-[7px] rounded-lg border border-[#edf0eb] bg-[#fbfcfa] px-[11px] py-[10px]"><span className="text-xs font-bold tracking-[.1em] text-[#879389]">BASE URL</span><code className="text-[14px] text-[#536358]">https://api.nia.neupgroup.com/v1</code></div><div className="mt-[15px] flex items-center justify-between text-xs font-semibold text-[#7d897f]"><span>cURL</span><Button variant="plain" size="sm" className="!h-[30px] !gap-[5px] !px-2 !text-xs !text-[#78857b]" onClick={copyExample}>{copied ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}{copied ? "Copied" : "Copy"}</Button></div><pre className="mt-1 overflow-auto rounded-lg bg-[#202a25] p-3 font-mono text-xs leading-[1.75] text-[#d4e1d5]"><code>{example}</code></pre></article>
        <article className="flex flex-col items-start rounded-xl border border-[#e6ebe4] bg-white p-[18px]"><div className="mb-[15px] grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-[#eff4ed] text-[#67846a]"><Icon name="key" size={18} /></div><span className="text-xs font-bold tracking-[.1em] text-[#7c8c7e]">YOUR CREDENTIALS</span><h2 className="mt-[7px] text-base font-semibold tracking-[-.025em] text-[#3c4940]">Keep your keys safe</h2><p className="my-2 mb-4 text-[14px] leading-[1.7] text-[#818c83]">API keys let your apps connect to Nia. Key creation will be enabled when the API service is connected.</p><div className="mb-3 flex w-full items-center gap-2 rounded-lg border border-dashed border-[#e1e7df] p-[10px] text-[13px] text-[#89938a]"><span className="h-[6px] w-[6px] rounded-full bg-[#c3ccc3]" /><span>No API keys yet</span></div><Button variant="solid" className="!h-10 !w-full !rounded-lg !bg-[#52785e] !text-[14px]" disabled title="API key management will be available when Nia’s API is connected"><Icon name="key" size={15} /> Create your first key</Button></article>
      </div>
      <div className="mt-[15px] flex items-center gap-[11px] rounded-[10px] border border-[#e8ece6] bg-[#fbfcfa] px-[14px] py-3 max-[600px]:flex-wrap max-[600px]:items-start"><span className="text-[#849387]"><Icon name="help" size={17} /></span><div className="grid gap-[3px]"><strong className="text-[14px] font-semibold text-[#5d695f]">Need a hand?</strong><span className="text-[13px] text-[#858f86]">Explore the API setup guide or reach out to support.</span></div><Link href="https://github.com/neupgroup/neup.cloud" target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-[5px] text-[13px] font-medium text-[#607d64] hover:text-[#365e45] max-[600px]:ml-7">Read the guide <Icon name="external" size={13} /></Link></div><p className="my-[10px] text-[14px] text-[#89928b]">API access is being prepared for Nia. Keys and requests will be available when the service is connected.</p>
    </div>
  </section>;
}
