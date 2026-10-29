"use client";
import Link from "next/link";
import { keyClientService } from "../../../services/client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@neup/components/ui/button";
import { Input } from "@neup/components/ui/input";
import { Icon } from "../../ui-icon";

type SavedKey = {
  id: number;
  provider: string;
  model: string | null;
  keyPreview: string;
  balance: string | null;
  addedOn: string;
};

/** Lists saved provider credentials and lets the user add or remove a key. */
export default function ManageKeysPage() {
  const [keys, setKeys] = useState<SavedKey[]>([]);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [secret, setSecret] = useState("");
  const [balance, setBalance] = useState("");
  const [uncapped, setUncapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  /** Loads saved key metadata for the list. */
  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const response = await keyClientService.list();
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

  useEffect(() => { void loadKeys(); }, [loadKeys]);

  /** Saves a provider credential from the form. */
  async function addKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await keyClientService.create({ provider, model, key: secret, balance: uncapped ? null : balance });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save key.");
      setSecret("");
      setProvider("");
      setModel("");
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

  /** Removes a saved key from the list. */
  async function deleteKey(id: number) {
    setMessage("");
    try {
      const response = await keyClientService.remove(id);
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
            <label className="setting-field"><span>Provider</span><Input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="e.g. google, openai, openrouter" required /></label>
            <label className="setting-field"><span>Model (optional)</span><Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="e.g. gemini-3.1-flash-lite" /></label>
            <label className="setting-field"><span>API key</span><Input type="password" autoComplete="new-password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="Paste your provider key" required /></label>
            <div className="setting-field"><span>Balance limit</span><div className="balance-entry"><Input type="number" inputMode="decimal" min="0" step="0.00000001" value={balance} onChange={(event) => setBalance(event.target.value)} placeholder="0.00" disabled={uncapped} required={!uncapped} /><Button type="button" variant={uncapped ? "solid" : "outlined"} className={`uncapped-button${uncapped ? " selected" : ""}`} aria-pressed={uncapped} onClick={() => setUncapped((current) => !current)}>Uncapped</Button></div></div>
            <p className="key-form-note"><Icon name="help" size={14} /> {uncapped ? "No balance cap will be applied to this provider key." : "Balance is recorded as entered; connect provider billing to keep it current."}</p>
            <Button type="submit" variant="solid" className="full-button" disabled={saving || !provider.trim()}>{saving ? "Saving…" : <><Icon name="plus" size={16} /> Save provider key</>}</Button>
          </form>

          <section className="api-card saved-keys-card" aria-labelledby="saved-keys-title">
            <div className="card-title-row"><div><span className="card-eyebrow">CONNECTED CREDENTIALS</span><h2 id="saved-keys-title">Saved keys</h2></div><span className="key-count">{keys.length}</span></div>
            <p className="saved-keys-description">Nia uses these credentials when requesting AI responses.</p>
            {message && <p className={`keys-message${message.includes("saved") || message.includes("removed") ? " success" : ""}`} role="status">{message}</p>}
            {loading ? <div className="keys-empty"><span className="key-placeholder-dot" />Loading saved keys…</div> : keys.length ? <div className="saved-key-list">{keys.map((entry) => <article className="saved-key-row" key={entry.id}><span className="saved-key-icon"><Icon name="key" size={16} /></span><Link href={`/manage/keys/${entry.id}`} className="saved-key-details saved-key-link"><strong>{entry.provider}{entry.model ? <span> · {entry.model}</span> : null}</strong><code>{entry.keyPreview}</code><small>{entry.balance === null ? "Uncapped · no balance limit" : `Balance ${entry.balance}`} · Added {new Date(entry.addedOn).toLocaleDateString()}</small></Link><Button type="button" variant="plain" size="icon" aria-label={`Remove ${entry.provider} key`} className="remove-key-button" onClick={() => void deleteKey(entry.id)}><span aria-hidden="true">×</span></Button></article>)}</div> : <div className="keys-empty"><span className="key-placeholder-dot" />No provider keys saved yet.</div>}
            <div className="key-security-note"><Icon name="help" size={16} /><span>Secret key values are never displayed after saving.</span></div>
          </section>
        </div>
      </div>
    </section>
  );
}
