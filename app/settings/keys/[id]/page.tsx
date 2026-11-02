"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@neup/components/ui/button";
import { keyClientService } from "../../../../services/client";
import { Icon } from "../../../ui-icon";

type SavedKey = {
  id: string;
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
  const id = rawId;

  useEffect(() => {
    let cancelled = false;

    /** Loads the requested credential from the saved key list. */
    async function loadKey() {
      setLoading(true);
      setMessage("");
      try {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error("This key ID is invalid.");
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
      router.push("/settings/keys");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove this key.");
      setRemoving(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),980px)] py-[39px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),980px)] max-[760px]:pt-7 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[22px]">
        <div className="mb-[25px] [&_h1]:m-0 [&_h1]:text-[clamp(35px,4vw,47px)] [&_h1]:font-medium [&_h1]:tracking-[-.055em] [&_h1]:text-foreground [&_p]:mb-0 [&_p]:mt-2 [&_p]:text-[15px] [&_p]:text-muted-foreground">
          <h1>{key ? `${key.provider} key` : "Provider key"}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">View the saved configuration for this provider credential.</p>
        </div>

        <div className="max-w-[760px] rounded-xl border border-border bg-card p-[18px]">
          {loading ? <div className="flex min-h-[110px] items-center justify-center gap-[9px] rounded-lg border border-dashed border-border text-sm text-muted-foreground"><span className="h-[6px] w-[6px] rounded-full bg-muted-foreground/40" />Loading key details…</div> : key ? <>
            <div className="flex items-start justify-between [&_h2]:mt-[7px] [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-[-.025em] [&_h2]:text-foreground"><div><h2>{key.provider}</h2></div><span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary"><Icon name="key" size={16} /></span></div>
            {message && <p className="mb-[11px] rounded-lg border border-danger/20 bg-danger/5 px-[11px] py-[9px] text-[13px] text-danger" role="alert">{message}</p>}
            <dl className="my-[18px] grid border-t border-border [&>div]:grid [&>div]:grid-cols-[minmax(120px,0.35fr)_minmax(0,1fr)] [&>div]:gap-4 [&>div]:border-b [&>div]:border-border [&>div]:py-[13px] [&_dt]:text-[13px] [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:break-words [&_dd]:text-sm [&_dd]:text-foreground [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-muted-foreground">
              <div><dt>Model</dt><dd>{key.model || "Not specified"}</dd></div>
              <div><dt>API key</dt><dd><code>{key.keyPreview}</code></dd></div>
              <div><dt>Balance limit</dt><dd>{key.balance === null ? "Uncapped" : key.balance}</dd></div>
              <div><dt>Added</dt><dd>{new Date(key.addedOn).toLocaleString()}</dd></div>
              <div><dt>Last updated</dt><dd>{new Date(key.updatedOn).toLocaleString()}</dd></div>
            </dl>
            <div className="mt-[18px] flex items-center justify-between gap-3">
              <Link href="/settings/keys" className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border px-[10px] text-[13px] font-medium text-primary hover:border-primary-300 hover:bg-muted">Back to keys</Link>
              <Button type="button" variant="outlined" className="text-danger" disabled={removing} onClick={() => void removeKey()}>{removing ? "Removing…" : "Remove key"}</Button>
            </div>
          </> : <>
            <p className="mb-[11px] rounded-lg border border-danger/20 bg-danger/5 px-[11px] py-[9px] text-[13px] text-danger" role="alert">{message || "This saved key could not be found."}</p>
            <Link href="/settings/keys" className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border px-[10px] text-[13px] font-medium text-primary hover:border-primary-300 hover:bg-muted">Back to keys</Link>
          </>}
        </div>
        <p className="mt-[15px] flex items-center gap-2 border-t border-border pt-[13px] text-[13px] text-muted-foreground [&_svg]:shrink-0"><Icon name="help" size={16} /><span>Secret key values are never displayed after saving.</span></p>
      </div>
    </section>
  );
}
