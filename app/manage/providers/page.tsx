"use client";
import { chatClientService, keyClientService, modelClientService, providerClientService } from "../../../services/client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@neup/components/ui/button";
import { Input } from "@neup/components/ui/input";
import { Link } from "@neup/components/ui/link";
import { Icon } from "../../ui-icon";

type Provider = { id: number; name: string; code: string; created_on: string; status: string };

export default function ManageProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [reqMethod, setReqMethod] = useState("");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await providerClientService.list();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load providers.");
      setProviders(result);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load providers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProviders(); }, [loadProviders]);

  async function addProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await providerClientService.create({ name, code, status, reqMethod });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save provider.");
      setName("");
      setCode("");
      setReqMethod("");
      await loadProviders();
      setMessage("Provider saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save provider.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(provider: Provider) {
    const nextStatus = provider.status.toLowerCase() === "active" ? "inactive" : "active";
    setMessage("");
    try {
      const response = await providerClientService.setStatus(provider.id, nextStatus);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update provider.");
      setProviders((current) => current.map((entry) => entry.id === provider.id ? result : entry));
      setMessage("Provider status updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update provider.");
    }
  }

  async function deleteProvider(id: number) {
    setMessage("");
    try {
      const response = await providerClientService.remove(id);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to delete provider.");
      setProviders((current) => current.filter((entry) => entry.id !== id));
      setMessage("Provider removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete provider.");
    }
  }

  return (
    <section className="keys-page">
      <header className="topbar"><div className="breadcrumb"><span>Manage</span><span className="crumb-slash">/</span><strong>Providers</strong></div><span className="settings-save-status"><Icon name="key" size={14} /> Provider catalog</span></header>
      <div className="keys-content">
        <div className="page-intro"><div className="page-icon"><Icon name="key" size={19} /></div><p className="page-eyebrow">AI PROVIDERS</p><h1>Manage providers</h1><p className="page-description">Keep track of AI services used by your models and provider keys.</p></div>
        <div className="keys-layout">
          <form className="api-card key-form" onSubmit={addProvider}>
            <div className="settings-panel-header"><div><h2>Add a provider</h2><p>Provider codes are used to identify services.</p></div><span className="access-icon"><Icon name="key" size={17} /></span></div>
            <label className="setting-field"><span>Name</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. OpenAI" required /></label>
            <label className="setting-field"><span>Code</span><Input value={code} onChange={(event) => setCode(event.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="e.g. openai" pattern="[a-z0-9][a-z0-9_-]{1,49}" required /><small className="provider-code-hint">Letters, numbers, hyphens, and underscores.</small></label>
            <label className="setting-field"><span>Request method <small>Optional default cURL template</small></span><textarea className="reqmethod-input" value={reqMethod} onChange={(event) => setReqMethod(event.target.value)} placeholder={'curl -X POST https://api.example.com/chat -H "Content-Type: application/json" -d \'{"model":"{{modelcode}}","messages":{{input}}}\'\n---response---\n{"output":"{{output}}"}'} rows={8} /></label>
            <p className="key-form-note"><Icon name="help" size={14} /> {'{{modelcode}}'} (or {'{{model}}'}) uses the model code; {'{{provider}}'} uses the provider code. Also supports plain-text {'{{input}}'}, formatted {'{{chathistory}}'}, {'{{apikey}}'}, and persona sections such as {'{{persona}}'} or {'{{persona.estate.json}}'}.</p>
            <label className="setting-field"><span>Status</span><select className="settings-select key-provider" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            {message && <p className={`keys-message${message.includes("saved") || message.includes("updated") || message.includes("removed") ? " success" : ""}`} role="status">{message}</p>}
            <Button type="submit" variant="solid" className="full-button" disabled={saving}>{saving ? "Saving…" : <><Icon name="plus" size={16} /> Save provider</>}</Button>
          </form>

          <section className="api-card saved-keys-card" aria-labelledby="providers-title">
            <div className="card-title-row"><div><span className="card-eyebrow">CONFIGURED SERVICES</span><h2 id="providers-title">Providers</h2></div><span className="key-count">{providers.length}</span></div>
            <p className="saved-keys-description">Active providers can be assigned to models and keys.</p>
            {loading ? <div className="keys-empty"><span className="key-placeholder-dot" />Loading providers…</div> : providers.length ? <div className="saved-key-list">{providers.map((provider) => <article className="saved-key-row" key={provider.id}><span className="saved-key-icon"><Icon name="key" size={16} /></span><div className="saved-key-details"><strong>{provider.name}</strong><code>{provider.code}</code><small>Added {new Date(provider.created_on).toLocaleDateString()}</small></div><span className={`model-state${provider.status.toLowerCase() === "active" ? " active" : ""}`}>{provider.status}</span><Link href={`/manage/provider/${provider.id}`} className="docs-link">View / edit</Link><Button type="button" variant="plain" size="sm" className="provider-status-button" onClick={() => void toggleStatus(provider)}>{provider.status.toLowerCase() === "active" ? "Disable" : "Enable"}</Button><Button type="button" variant="plain" size="icon" aria-label={`Remove ${provider.name}`} className="remove-key-button" onClick={() => void deleteProvider(provider.id)}><span aria-hidden="true">×</span></Button></article>)}</div> : <div className="keys-empty"><span className="key-placeholder-dot" />No providers configured yet.</div>}
          </section>
        </div>
      </div>
    </section>
  );
}
