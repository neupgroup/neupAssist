"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@neup/components/ui/button";
import { apiTokenClientService } from "@/services/client";
import { Icon } from "@/app/ui-icon";

type ApiKeyRecord = {
  id: string;
  keyPreview: string;
  added_on: string;
  expired_on: string;
};
type CreatedApiKey = Omit<ApiKeyRecord, "keyPreview"> & { key: string };

/** Manages account API keys and shows a generated secret only once. */
export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [expiresInDays, setExpiresInDays] = useState(365);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  /** Fetches key metadata without exposing stored secret values. */
  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiTokenClientService.list();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load API keys.");
      setKeys(result as ApiKeyRecord[]);
      setError("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load API keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadKeys(); }, [loadKeys]);

  /** Creates a new account API key and retains its secret only in page state. */
  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");
    setCreatedKey(null);
    setCopied(false);
    try {
      const response = await apiTokenClientService.create(expiresInDays);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create an API key.");
      setCreatedKey(result as CreatedApiKey);
      setNotice("API key created. Copy the secret now; it will not be shown again.");
      await loadKeys();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not create an API key.");
    } finally {
      setCreating(false);
    }
  }

  /** Copies the newly created secret to the clipboard. */
  async function copyCreatedKey() {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
    } catch {
      setError("Could not access the clipboard. Select and copy the key manually.");
    }
  }

  /** Revokes an API key belonging to the current account. */
  async function revokeKey(id: string) {
    setRevokingId(id);
    setError("");
    try {
      const response = await apiTokenClientService.remove(id);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not revoke this API key.");
      setKeys((current) => current.filter((key) => key.id !== id));
      if (createdKey?.id === id) setCreatedKey(null);
      setNotice("API key revoked.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not revoke this API key.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),900px)] py-[39px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),900px)] max-[760px]:pt-7 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[22px]">
        <Link href="/settings/api" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><Icon name="arrowRight" className="rotate-180" size={15} /> API settings</Link>
        <Link href="/settings/api/usage" className="mb-4 ml-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><Icon name="code" size={15} /> API usage</Link>
        <div className="mb-6">
          <h1 className="m-0 text-[clamp(35px,4vw,47px)] font-medium tracking-[-.055em] text-foreground">API keys</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Create keys for requests to the Responses API. Send them in the <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">x-token</code> header.</p>
        </div>

        {error && <p className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        {notice && <p className="mb-4 rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-sm text-success" role="status">{notice}</p>}

        {createdKey && <section className="mb-4 rounded-xl border border-success/30 bg-success/5 p-5" aria-labelledby="new-api-key-title">
          <h2 id="new-api-key-title" className="m-0 text-base font-semibold text-foreground">Your new API key</h2>
          <p className="mt-1 text-sm text-muted-foreground">Copy this key now. For your security, the full value is only shown once.</p>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-card p-2 max-sm:items-stretch max-sm:flex-col">
            <code className="min-w-0 flex-1 break-all px-2 py-1 text-sm text-foreground">{createdKey.key}</code>
            <Button type="button" variant="outlined" className="shrink-0" onClick={() => void copyCreatedKey()}><Icon name={copied ? "check" : "copy"} size={15} />{copied ? "Copied" : "Copy key"}</Button>
          </div>
        </section>}

        <form className="mb-5 rounded-xl border border-border bg-card p-5" onSubmit={createKey}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="m-0 text-base font-semibold text-foreground">Generate a key</h2>
              <p className="mb-0 mt-1 text-sm text-muted-foreground">Choose how long the key remains valid.</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1.5 text-sm text-muted-foreground">
                Expires after
                <select className="h-10 rounded-lg border border-border bg-background px-3 text-foreground" value={expiresInDays} onChange={(event) => setExpiresInDays(Number(event.target.value))}>
                  <option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>1 year</option>
                </select>
              </label>
              <Button type="submit" variant="solid" disabled={creating}>{creating ? "Generating…" : <><Icon name="plus" size={16} /> Generate API key</>}</Button>
            </div>
          </div>
        </form>

        <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="existing-api-keys-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="existing-api-keys-title" className="m-0 text-base font-semibold text-foreground">Existing keys</h2>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{keys.length}</span>
          </div>
          {loading ? <p className="mb-0 mt-4 text-sm text-muted-foreground">Loading API keys…</p> : keys.length ? <ul className="mb-0 mt-3 grid list-none p-0">
            {keys.map((key) => {
              const expired = new Date(key.expired_on).getTime() <= Date.now();
              return <li key={key.id} className="flex min-w-0 items-center gap-3 border-t border-border py-4 max-sm:flex-wrap">
                <Icon name="key" size={17} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <code className="block truncate text-sm text-foreground">{key.keyPreview}</code>
                  <p className="mb-0 mt-1 text-xs text-muted-foreground">{expired ? "Expired" : "Expires"} {new Date(key.expired_on).toLocaleDateString()} · Created {new Date(key.added_on).toLocaleDateString()}</p>
                </div>
                <Button type="button" variant="plain" className="shrink-0 text-danger hover:bg-danger/10" disabled={revokingId === key.id} onClick={() => void revokeKey(key.id)}><Icon name="trash" size={15} />{revokingId === key.id ? "Revoking…" : "Revoke"}</Button>
              </li>;
            })}
          </ul> : <p className="mb-0 mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No API keys yet. Generate one to start using the Responses API.</p>}
        </section>
      </div>
    </section>
  );
}
