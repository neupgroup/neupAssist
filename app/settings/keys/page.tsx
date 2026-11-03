"use client";
import Link from "next/link";
import { keyClientService } from "../../../services/client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@neup/components/ui/button";
import { Input } from "@neup/components/ui/input";
import { Icon } from "../../ui-icon";

type SavedKey = {
  id: string;
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
  async function deleteKey(id: string) {
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
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),980px)] py-[39px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),980px)] max-[760px]:pt-7 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[22px]">
        <div className="mb-[25px] [&_h1]:m-0 [&_h1]:text-[clamp(35px,4vw,47px)] [&_h1]:font-medium [&_h1]:tracking-[-.055em] [&_h1]:text-foreground [&_p]:mb-0 [&_p]:mt-2 [&_p]:text-[15px] [&_p]:text-muted-foreground">
          <h1>Manage keys</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Connect your AI provider credentials so Nia can use them to generate responses.</p>
        </div>

        <div className="grid grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)] items-start gap-[15px] max-[760px]:grid-cols-1">
          <form className="rounded-xl border border-border bg-card p-[18px] min-w-0" onSubmit={addKey}>
            <div className="mb-[23px] flex items-center justify-between [&_h2]:m-0 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-[-.02em] [&_h2]:text-foreground [&_p]:mt-[5px] [&_p]:text-sm [&_p]:text-muted-foreground"><div><h2>Add a provider key</h2><p>Credentials are saved to your configured database.</p></div><span className="mb-[15px] grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-primary/10 text-primary"><Icon name="key" size={17} /></span></div>
            <label className="my-[17px] grid gap-[7px] text-[13px] font-medium text-muted-foreground [&>div]:max-w-[440px] [&_input]:h-10 [&_input]:rounded-lg [&_input]:border-border [&_input]:bg-card [&_input]:text-sm [&_input]:text-foreground [&_input:read-only]:bg-background [&_input:read-only]:text-muted-foreground [&_small]:ml-1 [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"><span>Provider</span><Input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="e.g. google, openai, openrouter" required /></label>
            <label className="my-[17px] grid gap-[7px] text-[13px] font-medium text-muted-foreground [&>div]:max-w-[440px] [&_input]:h-10 [&_input]:rounded-lg [&_input]:border-border [&_input]:bg-card [&_input]:text-sm [&_input]:text-foreground [&_input:read-only]:bg-background [&_input:read-only]:text-muted-foreground [&_small]:ml-1 [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"><span>Model file (optional)</span><Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="e.g. googleapis.gemini-3.1-flash-lite" /></label>
            <label className="my-[17px] grid gap-[7px] text-[13px] font-medium text-muted-foreground [&>div]:max-w-[440px] [&_input]:h-10 [&_input]:rounded-lg [&_input]:border-border [&_input]:bg-card [&_input]:text-sm [&_input]:text-foreground [&_input:read-only]:bg-background [&_input:read-only]:text-muted-foreground [&_small]:ml-1 [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"><span>API key</span><Input type="password" autoComplete="new-password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="Paste your provider key" required /></label>
            <div className="my-[17px] grid gap-[7px] text-[13px] font-medium text-muted-foreground [&>div]:max-w-[440px] [&_input]:h-10 [&_input]:rounded-lg [&_input]:border-border [&_input]:bg-card [&_input]:text-sm [&_input]:text-foreground [&_input:read-only]:bg-background [&_input:read-only]:text-muted-foreground [&_small]:ml-1 [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"><span>Balance limit</span><div className="flex items-center gap-2 [&_input]:min-w-0 [&_input]:flex-1"><Input type="number" inputMode="decimal" min="0" step="0.00000001" value={balance} onChange={(event) => setBalance(event.target.value)} placeholder="0.00" disabled={uncapped} required={!uncapped} /><Button type="button" variant={uncapped ? "solid" : "outlined"} className={`h-10 shrink-0 rounded-lg text-[13px] ${uncapped ? "!bg-primary !text-primary-foreground" : ""}`} aria-pressed={uncapped} onClick={() => setUncapped((current) => !current)}>Uncapped</Button></div></div>
            <p className="my-[17px] mb-[14px] flex items-start gap-[7px] text-[13px] leading-[1.55] text-muted-foreground [&_svg]:mt-0.5 [&_svg]:shrink-0"><Icon name="help" size={14} /> {uncapped ? "No balance cap will be applied to this provider key." : "Balance is recorded as entered; connect provider billing to keep it current."}</p>
            <Button type="submit" variant="solid" className="h-10 w-full rounded-lg bg-primary text-sm" disabled={saving || !provider.trim()}>{saving ? "Saving…" : <><Icon name="plus" size={16} /> Save provider key</>}</Button>
          </form>

          <section className="rounded-xl border border-border bg-card p-[18px] min-w-0" aria-labelledby="saved-keys-title">
            <div className="flex items-start justify-between [&_h2]:mt-[7px] [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-[-.025em] [&_h2]:text-foreground"><div><h2 id="saved-keys-title">Saved keys</h2></div><span className="grid h-7 min-w-7 place-items-center rounded-lg bg-primary/10 text-[13px] font-semibold text-primary">{keys.length}</span></div>
            <p className="my-0 mb-[15px] mt-2 text-sm leading-[1.55] text-muted-foreground">Nia uses these credentials when requesting AI responses.</p>
            {message && <p className={`mb-[11px] rounded-lg border px-[11px] py-[9px] text-[13px] ${message.includes("saved") || message.includes("removed") ? "border-success/20 bg-success/5 text-success" : "border-danger/20 bg-danger/5 text-danger"}`} role="status">{message}</p>}
            {loading ? <div className="flex min-h-[110px] items-center justify-center gap-[9px] rounded-lg border border-dashed border-border text-sm text-muted-foreground"><span className="h-[6px] w-[6px] rounded-full bg-muted-foreground/40" />Loading saved keys…</div> : keys.length ? <div className="grid">{keys.map((entry) => <article className="flex min-w-0 items-center gap-[11px] border-t border-border py-[14px]" key={entry.id}><span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary"><Icon name="key" size={16} /></span><Link href={`/settings/keys/${entry.id}`} className="grid min-w-0 flex-1 gap-[3px] [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-sm [&_strong]:font-semibold [&_strong]:text-foreground [&_strong_span]:font-normal [&_strong_span]:text-muted-foreground [&_code]:font-mono [&_code]:text-xs [&_code]:text-muted-foreground [&_small]:text-xs [&_small]:text-muted-foreground text-inherit no-underline hover:[&_strong]:text-primary"><strong>{entry.provider}{entry.model ? <span> · {entry.model}</span> : null}</strong><code>{entry.keyPreview}</code><small>{entry.balance === null ? "Uncapped · no balance limit" : `Balance ${entry.balance}`} · Added {new Date(entry.addedOn).toLocaleDateString()}</small></Link><Button type="button" variant="plain" size="icon" aria-label={`Remove ${entry.provider} key`} className="h-[30px] w-[30px] shrink-0 text-muted-foreground hover:bg-danger/10 hover:text-danger" onClick={() => void deleteKey(entry.id)}><Icon name="trash" size={15} /></Button></article>)}</div> : <div className="flex min-h-[110px] items-center justify-center gap-[9px] rounded-lg border border-dashed border-border text-sm text-muted-foreground"><span className="h-[6px] w-[6px] rounded-full bg-muted-foreground/40" />No provider keys saved yet.</div>}
            <div className="mt-[15px] flex items-center gap-2 border-t border-border pt-[13px] text-[13px] text-muted-foreground [&_svg]:shrink-0"><Icon name="help" size={16} /><span>Secret key values are never displayed after saving.</span></div>
          </section>
        </div>
      </div>
    </section>
  );
}
