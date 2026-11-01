"use client";

import Link from "next/link";
import { useActionState } from "react";
import { withAppBasePath } from "@/services/app-url";
import { Button } from "@neup/components/ui/button";
import { Input } from "@neup/components/ui/input";
import { Textarea } from "@neup/components/ui/textarea";
import { Icon } from "@/app/ui-icon";
import { updateApplication } from "./actions";

type EditableApplication = {
  id: string;
  name: string;
  description: string;
  category: string;
  instructions: string;
  endpoints: string;
  authMethod: string;
  moreDetails: string | null;
  displayImage: string | null;
  coverImage: string | null;
};

/** Renders a prefilled application editor with save and cancel actions. */
export default function EditApplicationForm({ application }: { application: EditableApplication }) {
  const [state, formAction, pending] = useActionState(updateApplication, {});

  return (
    <form action={formAction} className="api-card grid gap-1">
      <input type="hidden" name="id" value={application.id} />
      <div className="settings-panel-header"><div><h2>Application details</h2><p>Fields marked required must be provided.</p></div><span className="access-icon"><Icon name="code" size={18} /></span></div>
      {state.error && <p className="keys-message" role="alert">{state.error}</p>}
      <label className="setting-field"><span>Name</span><Input name="name" defaultValue={application.name} placeholder="e.g. Neup Estate" required /></label>
      <label className="setting-field"><span>Description</span><Textarea name="description" defaultValue={application.description} placeholder="What this application does" required /></label>
      <label className="setting-field"><span>Category</span><Input name="category" defaultValue={application.category} placeholder="e.g. Real Estate" required /></label>
      <label className="setting-field"><span>Display image URL <small>Optional</small></span><Input name="displayImage" type="url" defaultValue={application.displayImage ?? ""} placeholder="https://example.com/logo.png" /></label>
      <label className="setting-field"><span>Cover image URL <small>Optional</small></span><Input name="coverImage" type="url" defaultValue={application.coverImage ?? ""} placeholder="https://example.com/cover.jpg" /></label>
      <label className="setting-field"><span>Instructions</span><Textarea name="instructions" defaultValue={application.instructions} placeholder="How the app should use this integration" required /></label>
      <label className="setting-field"><span>Endpoints <small>JSON array</small></span><Textarea name="endpoints" className="min-h-[150px] font-mono text-xs" defaultValue={application.endpoints} spellCheck={false} required /></label>
      <label className="setting-field"><span>Authentication method</span><Input name="authMethod" defaultValue={application.authMethod} placeholder="e.g. x-auth header" required /></label>
      <label className="setting-field"><span>More details <small>Optional</small></span><Textarea name="moreDetails" defaultValue={application.moreDetails ?? ""} placeholder="Additional setup or usage details" /></label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ec] pt-4">
        <span className="text-xs text-[#89928b]">Endpoint data is stored as JSONB.</span>
        <div className="flex gap-2"><Button type="button" variant="outlined" onClick={() => window.location.assign(withAppBasePath(`/apps/${application.id}`))}>Cancel</Button><Button type="submit" variant="solid" disabled={pending}>{pending ? "Saving…" : <><Icon name="check" size={15} /> Save changes</>}</Button></div>
      </div>
    </form>
  );
}
