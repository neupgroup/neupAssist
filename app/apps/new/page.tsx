"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@neup/components/ui/button";
import { Input } from "@neup/components/ui/input";
import { Textarea } from "@neup/components/ui/textarea";
import { Icon } from "@/app/ui-icon";
import { createApplication } from "./actions";

const initialState = {};

/** Renders the form for adding an application to the catalog. */
export default function NewApplicationPage() {
  const [state, formAction, pending] = useActionState(createApplication, initialState);

  return (
    <section className="keys-page">
      <header className="topbar">
        <div className="breadcrumb"><Link href="/apps">Apps and Integrations</Link><span className="crumb-slash">/</span><strong>New application</strong></div>
        <Link href="/apps" className="text-sm text-[#738177] hover:text-[#365e45]">Back to apps</Link>
      </header>
      <div className="keys-content">
        <div className="page-intro">
          <div className="page-icon"><Icon name="plus" size={19} /></div>
          <p className="page-eyebrow">APPLICATION CATALOG</p>
          <h1>Add an application</h1>
          <p className="page-description">Describe the service and its endpoints so it can be listed in Apps and Integrations.</p>
        </div>

        <form action={formAction} className="api-card grid gap-1">
          <div className="settings-panel-header"><div><h2>Application details</h2><p>Fields marked required must be provided.</p></div><span className="access-icon"><Icon name="code" size={18} /></span></div>
          {state.error && <p className="keys-message" role="alert">{state.error}</p>}
          <label className="setting-field"><span>Name</span><Input name="name" placeholder="e.g. Neup Estate" required /></label>
          <label className="setting-field"><span>Description</span><Textarea name="description" placeholder="What this application does" required /></label>
          <label className="setting-field"><span>Category</span><Input name="category" placeholder="e.g. Real Estate" required /></label>
          <label className="setting-field"><span>Display image URL <small>Optional</small></span><Input name="displayImage" type="url" placeholder="https://example.com/logo.png" /></label>
          <label className="setting-field"><span>Cover image URL <small>Optional</small></span><Input name="coverImage" type="url" placeholder="https://example.com/cover.jpg" /></label>
          <label className="setting-field"><span>Instructions</span><Textarea name="instructions" placeholder="How the app should use this integration" required /></label>
          <label className="setting-field"><span>Endpoints <small>JSON array</small></span><Textarea name="endpoints" className="min-h-[150px] font-mono text-xs" defaultValue="[]" spellCheck={false} required /></label>
          <label className="setting-field"><span>Authentication method</span><Input name="authMethod" placeholder="e.g. x-auth header" required /></label>
          <label className="setting-field"><span>More details <small>Optional</small></span><Textarea name="moreDetails" placeholder="Additional setup or usage details" /></label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ec] pt-4">
            <span className="text-xs text-[#89928b]">Endpoint data is stored as JSONB.</span>
            <div className="flex gap-2"><Button type="button" variant="outlined" onClick={() => window.location.assign("/apps")}>Cancel</Button><Button type="submit" variant="solid" disabled={pending}>{pending ? "Saving…" : <><Icon name="check" size={15} /> Save application</>}</Button></div>
          </div>
        </form>
      </div>
    </section>
  );
}
