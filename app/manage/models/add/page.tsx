"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@neup/components/ui/button";
import { Input } from "@neup/components/ui/input";
import { Link } from "@neup/components/ui/link";
import { Icon } from "../../../ui-icon";

type Provider = { id: number; name: string; code: string; status: string };

export default function AddModelPage() {
  const router = useRouter();
  const [providersList, setProvidersList] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelCode, setModelCode] = useState("");
  const [reqMethod, setReqMethod] = useState("");
  const [costInput, setCostInput] = useState("");
  const [costOutput, setCostOutput] = useState("");
  const [status, setStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/manage/providers", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load providers.");
        const available = (result as Provider[]).filter((provider) => provider.status.toLowerCase() === "active");
        setProvidersList(available);
        if (available.length) setProviderId(String(available[0].id));
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load providers."));
  }, []);

  async function addModel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/manage/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: Number(providerId), name: modelName, code: modelCode, cost_input: costInput, cost_output: costOutput, reqMethod, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save model.");
      router.push("/manage/models");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save model.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="keys-page">
      <header className="topbar"><div className="breadcrumb"><Link href="/manage/models">Manage models</Link><span className="crumb-slash">/</span><strong>Add model</strong></div><Link href="/manage/models" className="docs-link">Back to models</Link></header>
      <div className="keys-content add-model-content">
        <div className="page-intro"><div className="page-icon"><Icon name="plus" size={19} /></div><p className="page-eyebrow">AI MODEL CATALOG</p><h1>Add a model</h1><p className="page-description">Add a provider model and its token pricing. You can change its priority from the model catalog.</p></div>
        <form className="api-card key-form add-model-form" onSubmit={addModel}>
          <div className="settings-panel-header"><div><h2>Model details</h2><p>The new model will be added to the end of the priority list.</p></div><span className="access-icon"><Icon name="code" size={17} /></span></div>
          <label className="setting-field"><span>Provider</span><select className="settings-select key-provider" value={providerId} onChange={(event) => setProviderId(event.target.value)} required disabled={!providersList.length}><option value="">{providersList.length ? "Select a provider" : "Add an active provider first"}</option>{providersList.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
          <label className="setting-field"><span>Model name</span><Input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="e.g. gpt-4.1" required /></label>
          <label className="setting-field"><span>Model code <small>Sent to the provider API</small></span><Input value={modelCode} onChange={(event) => setModelCode(event.target.value)} placeholder="e.g. gpt-4.1" required /></label>
          <label className="setting-field"><span>Input cost <small>per 1M tokens</small></span><Input type="number" inputMode="decimal" min="0" step="0.00000001" value={costInput} onChange={(event) => setCostInput(event.target.value)} placeholder="0.00" required /></label>
          <label className="setting-field"><span>Output cost <small>per 1M tokens</small></span><Input type="number" inputMode="decimal" min="0" step="0.00000001" value={costOutput} onChange={(event) => setCostOutput(event.target.value)} placeholder="0.00" required /></label>
          <label className="setting-field"><span>Request method <small>Optional cURL template</small></span><textarea className="reqmethod-input" value={reqMethod} onChange={(event) => setReqMethod(event.target.value)} placeholder={'curl -X POST https://api.example.com/chat -H "Content-Type: application/json" -d \'{"model":"{{modelcode}}","messages":{{input}}}\'\n---response---\n{"output":"{{output}}"}'} rows={8} /></label>
          <p className="key-form-note"><Icon name="help" size={14} /> Use {'{{modelcode}}'} (or {'{{model}}'}), {'{{provider}}'}, {'{{input}}'}, and {'{{apikey}}'} in the cURL request. The model placeholder uses Model code. Add an optional <code>---response---</code> line and a JSON response shape containing {'{{output}}'} to extract and show its value.</p>
          <label className="setting-field"><span>Status</span><select className="settings-select key-provider" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <p className="key-form-note"><Icon name="help" size={14} /> Costs are stored as entered. Keep the unit consistent across catalog entries.</p>
          {message && <p className="keys-message" role="alert">{message}</p>}
          <div className="add-model-actions"><Link href="/manage/models" className="docs-link">Cancel</Link><Button type="submit" variant="solid" className="full-button" disabled={saving || !providerId}>{saving ? "Saving…" : <><Icon name="plus" size={16} /> Save model</>}</Button></div>
        </form>
      </div>
    </section>
  );
}
