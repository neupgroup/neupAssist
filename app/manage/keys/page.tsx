"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@neup/components/ui/button";
import { Input } from "@neup/components/ui/input";
import { Icon } from "../../ui-icon";

type SavedKey = {
  id: number;
  provider: string;
  model_id: number | null;
  model_name: string | null;
  keyPreview: string;
  balance: string | null;
  addedOn: string;
};

type Provider = { id: number; name: string; code: string; status: string };
type Model = { id: number; provider_id: number; model_name: string; status: string; provider: Provider };

export default function ManageKeysPage() {
  const [keys, setKeys] = useState<SavedKey[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [secret, setSecret] = useState("");
  const [balance, setBalance] = useState("");
  const [uncapped, setUncapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/manage/keys", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load keys.");
      setKeys(result);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const [providerResponse, modelResponse] = await Promise.all([
        fetch("/api/manage/providers", { cache: "no-store" }),
        fetch("/api/manage/models", { cache: "no-store" }),
      ]);
      const [providerResult, modelResult] = await Promise.all([providerResponse.json(), modelResponse.json()]);
      if (!providerResponse.ok) throw new Error(providerResult.error || "Unable to load providers.");
      if (!modelResponse.ok) throw new Error(modelResult.error || "Unable to load models.");
      setProviders(providerResult);
      setModels(modelResult);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load providers and models.");
    }
  }, []);

  useEffect(() => { void loadKeys(); void loadCatalog(); }, [loadKeys, loadCatalog]);

  const selectedProvider = providers.find((entry) => String(entry.id) === providerId);
  const availableModels = selectedProvider ? models.filter((entry) => entry.provider_id === selectedProvider.id && entry.status.toLowerCase() === "active") : [];

  async function addKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/manage/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider?.name ?? "", model_id: modelId || null, key: secret, balance: uncapped ? null : balance }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save key.");
      setSecret("");
      setModelId("");
      setBalance("");
      setUncapped(false);
      await loadKeys();
      setMessage("Key saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save key.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteKey(id: number) {
    setMessage("");
    try {
      const response = await fetch(`/api/manage/keys?id=${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to delete key.");
      setKeys((current) => current.filter((entry) => entry.id !== id));
      setMessage("Key removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete key.");
    }
  }

  return (
    <section className="keys-page">
      <header className="topbar">
        <div className="breadcrumb"><span>Manage</span><span className="crumb-slash">/</span><strong>Keys</strong></div>
        <span className="settings-save-status"><Icon name="key" size={14} /> Private credentials</span>
      </header>
      <div className="keys-content">
        <div className="page-intro">
          <div className="page-icon"><Icon name="key" size={19} /></div>
          <p className="page-eyebrow">AI PROVIDERS</p>
          <h1>Manage keys</h1>
          <p className="page-description">Connect your AI provider credentials so Nia can use them to generate responses.</p>
        </div>

        <div className="keys-layout">
          <form className="api-card key-form" onSubmit={addKey}>
            <div className="settings-panel-header"><div><h2>Add a provider key</h2><p>Credentials are saved to your configured database.</p></div><span className="access-icon"><Icon name="key" size={17} /></span></div>
            <label className="setting-field"><span>Provider</span><select className="settings-select key-provider" value={providerId} onChange={(event) => { setProviderId(event.target.value); setModelId(""); }} required><option value="">Choose a provider</option>{providers.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
            {selectedProvider && <label className="setting-field"><span>Model <small>Optional</small></span><select className="settings-select key-provider" value={modelId} onChange={(event) => setModelId(event.target.value)}><option value="">Any active model</option>{availableModels.map((entry) => <option key={entry.id} value={entry.id}>{entry.model_name}</option>)}</select>{availableModels.length === 0 && <small className="provider-code-hint">No active models are available for this provider.</small>}</label>}
            <label className="setting-field"><span>API key</span><Input type="password" autoComplete="new-password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="Paste your provider key" required /></label>
            <div className="setting-field"><span>Balance limit</span><div className="balance-entry"><Input type="number" inputMode="decimal" min="0" step="0.00000001" value={balance} onChange={(event) => setBalance(event.target.value)} placeholder="0.00" disabled={uncapped} required={!uncapped} /><Button type="button" variant={uncapped ? "solid" : "outlined"} className={`uncapped-button${uncapped ? " selected" : ""}`} aria-pressed={uncapped} onClick={() => setUncapped((current) => !current)}>Uncapped</Button></div></div>
            <p className="key-form-note"><Icon name="help" size={14} /> {uncapped ? "No balance cap will be applied to this provider key." : "Balance is recorded as entered; connect provider billing to keep it current."}</p>
            <Button type="submit" variant="solid" className="full-button" disabled={saving || !selectedProvider}>{saving ? "Saving…" : <><Icon name="plus" size={16} /> Save provider key</>}</Button>
          </form>

          <section className="api-card saved-keys-card" aria-labelledby="saved-keys-title">
            <div className="card-title-row"><div><span className="card-eyebrow">CONNECTED CREDENTIALS</span><h2 id="saved-keys-title">Saved keys</h2></div><span className="key-count">{keys.length}</span></div>
            <p className="saved-keys-description">Nia uses these credentials when requesting AI responses.</p>
            {message && <p className={`keys-message${message.includes("saved") || message.includes("removed") ? " success" : ""}`} role="status">{message}</p>}
            {loading ? <div className="keys-empty"><span className="key-placeholder-dot" />Loading saved keys…</div> : keys.length ? <div className="saved-key-list">{keys.map((entry) => <article className="saved-key-row" key={entry.id}><span className="saved-key-icon"><Icon name="key" size={16} /></span><div className="saved-key-details"><strong>{entry.provider}{entry.model_name ? <span> · {entry.model_name}</span> : null}</strong><code>{entry.keyPreview}</code><small>{entry.balance === null ? "Uncapped · no balance limit" : `Balance ${entry.balance}`} · Added {new Date(entry.addedOn).toLocaleDateString()}</small></div><Button type="button" variant="plain" size="icon" aria-label={`Remove ${entry.provider} key`} className="remove-key-button" onClick={() => void deleteKey(entry.id)}><span aria-hidden="true">×</span></Button></article>)}</div> : <div className="keys-empty"><span className="key-placeholder-dot" />No provider keys saved yet.</div>}
            <div className="key-security-note"><Icon name="help" size={16} /><span>Secret key values are never displayed after saving.</span></div>
          </section>
        </div>
      </div>
    </section>
  );
}
