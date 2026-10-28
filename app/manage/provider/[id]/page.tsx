"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@neup/components/ui/button";
import { Input } from "@neup/components/ui/input";
import { Link } from "@neup/components/ui/link";
import { Icon } from "../../../ui-icon";

type ProviderModel = { id: number; name: string; code: string; status: string };
type ProviderDetails = {
  id: number;
  name: string;
  code: string;
  created_on: string;
  status: string;
  reqMethod: string | null;
  models: ProviderModel[];
};
type TestResult = { model: string; output: string };

export default function ProviderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [provider, setProvider] = useState<ProviderDetails | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("active");
  const [reqMethod, setReqMethod] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/manage/providers/${id}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load provider.");
        if (cancelled) return;
        const details = result as ProviderDetails;
        setProvider(details);
        setName(details.name);
        setCode(details.code);
        setStatus(details.status.toLowerCase());
        setReqMethod(details.reqMethod ?? "");
      })
      .catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load provider."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/manage/providers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code, status, reqMethod }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update provider.");
      setProvider(result as ProviderDetails);
      setMessage("Provider updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update provider.");
    } finally {
      setSaving(false);
    }
  }

  async function testRequest() {
    setTesting(true);
    setTestResult(null);
    setTestError("");
    try {
      const response = await fetch(`/api/manage/providers/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reqMethod }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Provider test failed.");
      setTestResult(result as TestResult);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Provider test failed.");
    } finally {
      setTesting(false);
    }
  }

  return <section className="keys-page">
    <header className="topbar"><div className="breadcrumb"><Link href="/manage/providers">Manage providers</Link><span className="crumb-slash">/</span><strong>{provider?.name || "Provider details"}</strong></div><Link href="/manage/providers" className="docs-link">Back to providers</Link></header>
    <div className="keys-content add-model-content">
      <div className="page-intro"><div className="page-icon"><Icon name="key" size={19} /></div><p className="page-eyebrow">AI PROVIDERS</p><h1>{loading ? "Loading provider…" : provider?.name || "Provider not found"}</h1><p className="page-description">View and edit the provider details and its default request method.</p></div>
      {loading ? <div className="api-card keys-empty">Loading provider details…</div> : provider && <form className="api-card key-form add-model-form" onSubmit={save}>
        <div className="settings-panel-header"><div><h2>Provider details</h2><p>The default request method is used by its models unless they have an override.</p></div><span className="access-icon"><Icon name="key" size={17} /></span></div>
        <label className="setting-field"><span>Name</span><Input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="setting-field"><span>Code</span><Input value={code} onChange={(event) => setCode(event.target.value.toLowerCase().replace(/\s+/g, "-"))} pattern="[a-z0-9][a-z0-9_-]{1,49}" required /><small className="provider-code-hint">Letters, numbers, hyphens, and underscores.</small></label>
        <label className="setting-field"><span>Provider request method</span><textarea className="reqmethod-input" value={reqMethod} onChange={(event) => setReqMethod(event.target.value)} placeholder={'curl -X POST https://api.example.com/chat -H "Content-Type: application/json" -d \'{"model":"{{modelcode}}","provider":"{{provider}}","messages":{{input}}}\'\n---response---\n{"output":"{{output}}"}'} rows={10} /></label>
        <p className="key-form-note"><Icon name="help" size={14} /> This is the default cURL request and response format for all provider models without a model-specific override. {'{{modelcode}}'} (or {'{{model}}'}) uses the model code; {'{{provider}}'} uses the provider code. Also supports {'{{input}}'}, {'{{apikey}}'}, and the optional <code>---response---</code> format with {'{{output}}'}.</p>
        <div className="api-card saved-keys-card provider-test-card"><div className="card-title-row"><div><span className="card-eyebrow">REQUEST CHECK</span><h2>Test provider request</h2></div><span className="access-icon"><Icon name="code" size={16} /></span></div><p className="saved-keys-description">Compiles the request method above and sends <code>Hello World</code> using this provider’s saved key and an active model.</p><Button type="button" variant="outlined" onClick={() => void testRequest()} disabled={testing || saving}>{testing ? "Testing…" : "Test request"}</Button>{testError && <p className="keys-message" role="alert">{testError}</p>}{testResult && <div className="provider-test-result" role="status"><p className="key-form-note"><Icon name="check" size={14} /> Request succeeded with model {testResult.model}.</p><pre>{testResult.output}</pre></div>}</div>
        <label className="setting-field"><span>Status</span><select className="settings-select key-provider" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <p className="provider-code-hint">Created {new Date(provider.created_on).toLocaleString()}</p>
        <div className="api-card saved-keys-card"><div className="card-title-row"><div><span className="card-eyebrow">LINKED MODELS</span><h2>Models using this provider</h2></div><span className="key-count">{provider.models.length}</span></div>{provider.models.length ? <div className="saved-key-list">{provider.models.map((model) => <div className="saved-key-row" key={model.id}><div className="saved-key-details"><strong>{model.name}</strong><code>{model.code}</code></div><span className={`model-state${model.status.toLowerCase() === "active" ? " active" : ""}`}>{model.status}</span><Link href={`/manage/models/${model.id}`} className="docs-link">Edit model</Link></div>)}</div> : <p className="keys-empty">No models are linked to this provider yet.</p>}</div>
        {message && <p className={`keys-message${message.includes("updated") ? " success" : ""}`} role="status">{message}</p>}
        <div className="add-model-actions"><Link href="/manage/providers" className="docs-link">Cancel</Link><Button type="submit" variant="solid" className="full-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button></div>
      </form>}
    </div>
  </section>;
}
