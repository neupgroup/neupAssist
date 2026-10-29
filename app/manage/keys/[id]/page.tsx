"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@neup/components/ui/button";
import { keyClientService } from "../../../../services/client";
import { Icon } from "../../../ui-icon";

type SavedKey = {
  id: number;
  provider: string;
  model: string | null;
  keyPreview: string;
  balance: string | null;
  addedOn: string;
  updatedOn: string;
};

/** Displays the saved configuration for one provider key. */
export default function ManageKeyPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const router = useRouter();
  const [key, setKey] = useState<SavedKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [removing, setRemoving] = useState(false);
  const id = Number(rawId);

  useEffect(() => {
    let cancelled = false;

    /** Loads the requested credential from the saved key list. */
    async function loadKey() {
      setLoading(true);
      setMessage("");
      try {
        if (!Number.isSafeInteger(id) || id < 1) throw new Error("This key ID is invalid.");
        const response = await keyClientService.list();
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load this key.");
        const savedKey = (result as SavedKey[]).find((entry) => entry.id === id) ?? null;
        if (!savedKey) throw new Error("This saved key could not be found.");
        if (!cancelled) setKey(savedKey);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load this key.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadKey();
    return () => { cancelled = true; };
  }, [id]);

  /** Deletes this credential and returns to the key list. */
  async function removeKey() {
    if (!key) return;
    setRemoving(true);
    setMessage("");
    try {
      const response = await keyClientService.remove(key.id);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to remove this key.");
      router.push("/manage/keys");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove this key.");
      setRemoving(false);
    }
  }

  return (
    <section className="keys-page">
      <header className="topbar">
        <div className="breadcrumb"><Link href="/manage/keys">Manage keys</Link><span className="crumb-slash">/</span><strong>Key details</strong></div>
        <span className="settings-save-status"><Icon name="key" size={14} /> Private credentials</span>
      </header>
      <div className="keys-content">
        <div className="page-intro">
          <div className="page-icon"><Icon name="key" size={19} /></div>
          <p className="page-eyebrow">AI PROVIDERS</p>
          <h1>{key ? `${key.provider} key` : "Provider key"}</h1>
          <p className="page-description">View the saved configuration for this provider credential.</p>
        </div>

        <div className="key-detail-card api-card">
          {loading ? <div className="keys-empty"><span className="key-placeholder-dot" />Loading key details…</div> : key ? <>
            <div className="card-title-row"><div><span className="card-eyebrow">SAVED CREDENTIAL</span><h2>{key.provider}</h2></div><span className="saved-key-icon"><Icon name="key" size={16} /></span></div>
            {message && <p className="keys-message" role="alert">{message}</p>}
            <dl className="key-detail-list">
              <div><dt>Model</dt><dd>{key.model || "Not specified"}</dd></div>
              <div><dt>API key</dt><dd><code>{key.keyPreview}</code></dd></div>
              <div><dt>Balance limit</dt><dd>{key.balance === null ? "Uncapped" : key.balance}</dd></div>
              <div><dt>Added</dt><dd>{new Date(key.addedOn).toLocaleString()}</dd></div>
              <div><dt>Last updated</dt><dd>{new Date(key.updatedOn).toLocaleString()}</dd></div>
            </dl>
            <div className="key-detail-actions">
              <Link href="/manage/keys" className="model-add-link">Back to keys</Link>
              <Button type="button" variant="outlined" className="remove-detail-key" disabled={removing} onClick={() => void removeKey()}>{removing ? "Removing…" : "Remove key"}</Button>
            </div>
          </> : <>
            <p className="keys-message" role="alert">{message || "This saved key could not be found."}</p>
            <Link href="/manage/keys" className="model-add-link">Back to keys</Link>
          </>}
        </div>
        <p className="key-security-note"><Icon name="help" size={16} /><span>Secret key values are never displayed after saving.</span></p>
      </div>
    </section>
  );
}
