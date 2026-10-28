"use client";
import { chatClientService, keyClientService, modelClientService, providerClientService } from "../../../../services/client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@neup/components/ui/button";
import { Input } from "@neup/components/ui/input";
import { Link } from "@neup/components/ui/link";
import { Icon } from "../../../ui-icon";

type Provider = { id: number; name: string; code: string; status: string };
type ModelDetails = {
  id: number;
  provider_id: number;
  name: string;
  code: string;
  cost_input: string;
  cost_output: string;
  reqMethod: string | null;
  status: string;
  added_on: string;
  provider: Provider;
};

export default function ModelDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [model, setModel] = useState<ModelDetails | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelCode, setModelCode] = useState("");
  const [costInput, setCostInput] = useState("");
  const [costOutput, setCostOutput] = useState("");
  const [reqMethod, setReqMethod] = useState("");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [modelResponse, providersResponse] = await Promise.all([
          modelClientService.get(Number(id)),
          providerClientService.list(),
        ]);
        const [modelResult, providersResult] = await Promise.all([modelResponse.json(), providersResponse.json()]);
        if (!modelResponse.ok) throw new Error(modelResult.error || "Unable to load model.");
        if (!providersResponse.ok) throw new Error(providersResult.error || "Unable to load providers.");
        if (cancelled) return;
        const detail = modelResult as ModelDetails;
        setModel(detail);
        setProviders(providersResult as Provider[]);
        setProviderId(String(detail.provider_id));
        setModelName(detail.name);
        setModelCode(detail.code);
        setCostInput(detail.cost_input);
        setCostOutput(detail.cost_output);
        setReqMethod(detail.reqMethod ?? "");
        setStatus(detail.status.toLowerCase());
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load model.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await modelClientService.update(Number(id), { provider_id: Number(providerId), name: modelName, code: modelCode, cost_input: costInput, cost_output: costOutput, reqMethod, status });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update model.");
      setModel(result as ModelDetails);
      setMessage("Model updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update model.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="keys-page">
    <header className="topbar"><div className="breadcrumb"><Link href="/manage/models">Manage models</Link><span className="crumb-slash">/</span><strong>{model?.name || "Model details"}</strong></div><Link href="/manage/models" className="docs-link">Back to models</Link></header>
    <div className="keys-content add-model-content">
      <div className="page-intro"><div className="page-icon"><Icon name="code" size={19} /></div><p className="page-eyebrow">MODEL CATALOG</p><h1>{loading ? "Loading model…" : model?.name || "Model not found"}</h1><p className="page-description">View and edit this model’s catalog details and request method.</p></div>
      {loading ? <div className="api-card keys-empty">Loading model details…</div> : model && <form className="api-card key-form add-model-form" onSubmit={save}>
        <div className="settings-panel-header"><div><h2>Model details</h2><p>Changes here apply only to this model.</p></div><span className="access-icon"><Icon name="code" size={17} /></span></div>
        <label className="setting-field"><span>Provider</span><select className="settings-select key-provider" value={providerId} onChange={(event) => setProviderId(event.target.value)} required>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
        <label className="setting-field"><span>Model name</span><Input value={modelName} onChange={(event) => setModelName(event.target.value)} required /></label>
        <label className="setting-field"><span>Model code <small>Sent to the provider API</small></span><Input value={modelCode} onChange={(event) => setModelCode(event.target.value)} required /></label>
        <label className="setting-field"><span>Input cost <small>per 1M tokens</small></span><Input type="number" min="0" step="0.00000001" value={costInput} onChange={(event) => setCostInput(event.target.value)} required /></label>
        <label className="setting-field"><span>Output cost <small>per 1M tokens</small></span><Input type="number" min="0" step="0.00000001" value={costOutput} onChange={(event) => setCostOutput(event.target.value)} required /></label>
        <label className="setting-field"><span>Model request method <small>Optional override</small></span><textarea className="reqmethod-input" value={reqMethod} onChange={(event) => setReqMethod(event.target.value)} placeholder={'curl -X POST https://api.example.com/chat -H "Content-Type: application/json" -d \'{"model":"{{modelcode}}","messages":{{input}}}\'\n---response---\n{"output":"{{output}}"}'} rows={9} /></label>
        <p className="key-form-note"><Icon name="help" size={14} /> This request method overrides the provider default for this model. Leave it blank to use the provider request method. {'{{modelcode}}'} (or {'{{model}}'}) uses the model code; {'{{provider}}'} uses the provider code. Also supports plain-text {'{{input}}'}, formatted {'{{chathistory}}'}, {'{{apikey}}'}, persona sections such as {'{{persona}}'} or {'{{persona.estate.json}}'}, and the optional <code>---response---</code> format with {'{{output}}'}.</p>
        <label className="setting-field"><span>Status</span><select className="settings-select key-provider" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <p className="provider-code-hint">Added {new Date(model.added_on).toLocaleString()}</p>
        {message && <p className={`keys-message${message.includes("updated") ? " success" : ""}`} role="status">{message}</p>}
        <div className="add-model-actions"><Link href="/manage/models" className="docs-link">Cancel</Link><Button type="submit" variant="solid" className="full-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button></div>
      </form>}
    </div>
  </section>;
}
