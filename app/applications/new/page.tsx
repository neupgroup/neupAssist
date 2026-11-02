"use client";

import Link from "next/link";
import { useActionState } from "react";
import { withAppBasePath } from "@/services/app-url";
import { Button } from "@neup/components/ui/button";
import { Input } from "@neup/components/ui/input";
import { Textarea } from "@neup/components/ui/textarea";
import { Icon } from "@/app/ui-icon";
import { createApplication, type CreateApplicationState } from "./actions";

const initialState: CreateApplicationState = {};

/** Renders the form for adding an application to the catalog. */
export default function NewApplicationPage() {
  const [state, formAction, pending] = useActionState(createApplication, initialState);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),980px)] py-[39px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),980px)] max-[760px]:pt-7 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[22px]">
        <div className="mb-[25px] [&_h1]:m-0 [&_h1]:text-[clamp(35px,4vw,47px)] [&_h1]:font-medium [&_h1]:tracking-[-.055em] [&_h1]:text-foreground [&_p]:mb-0 [&_p]:mt-2 [&_p]:text-[15px] [&_p]:text-muted-foreground">
          <h1>Add an application</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Describe the service and its endpoints so it can be listed in Apps and Integrations.</p>
        </div>

        <form action={formAction} className="rounded-xl border border-border bg-card p-[18px] grid gap-1">
          <div className="mb-[23px] flex items-center justify-between [&_h2]:m-0 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-[-.02em] [&_h2]:text-foreground [&_p]:mt-[5px] [&_p]:text-sm [&_p]:text-muted-foreground"><div><h2>Application details</h2><p>Fields marked required must be provided.</p></div><span className="mb-[15px] grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-primary/10 text-primary"><Icon name="code" size={18} /></span></div>
          {state.error && <p className="mb-[11px] rounded-lg border border-danger/20 bg-danger/5 px-[11px] py-[9px] text-[13px] text-danger" role="alert">{state.error}</p>}
          <label className="my-[17px] grid gap-[7px] text-[13px] font-medium text-muted-foreground [&>div]:max-w-[440px] [&_input]:h-10 [&_input]:rounded-lg [&_input]:border-border [&_input]:bg-card [&_input]:text-sm [&_input]:text-foreground [&_input:read-only]:bg-background [&_input:read-only]:text-muted-foreground [&_small]:ml-1 [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"><span>Name</span><Input name="name" placeholder="e.g. Neup Estate" required /></label>
          <label className="my-[17px] grid gap-[7px] text-[13px] font-medium text-muted-foreground [&>div]:max-w-[440px] [&_input]:h-10 [&_input]:rounded-lg [&_input]:border-border [&_input]:bg-card [&_input]:text-sm [&_input]:text-foreground [&_input:read-only]:bg-background [&_input:read-only]:text-muted-foreground [&_small]:ml-1 [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"><span>Description</span><Textarea name="description" placeholder="What this application does" required /></label>
          <label className="my-[17px] grid gap-[7px] text-[13px] font-medium text-muted-foreground [&>div]:max-w-[440px] [&_input]:h-10 [&_input]:rounded-lg [&_input]:border-border [&_input]:bg-card [&_input]:text-sm [&_input]:text-foreground [&_input:read-only]:bg-background [&_input:read-only]:text-muted-foreground [&_small]:ml-1 [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"><span>Category</span><Input name="category" placeholder="e.g. Real Estate" required /></label>
          <label className="my-[17px] grid gap-[7px] text-[13px] font-medium text-muted-foreground [&>div]:max-w-[440px] [&_input]:h-10 [&_input]:rounded-lg [&_input]:border-border [&_input]:bg-card [&_input]:text-sm [&_input]:text-foreground [&_input:read-only]:bg-background [&_input:read-only]:text-muted-foreground [&_small]:ml-1 [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"><span>Display image URL <small>Optional</small></span><Input name="displayImage" type="url" placeholder="https://example.com/logo.png" /></label>
          <label className="my-[17px] grid gap-[7px] text-[13px] font-medium text-muted-foreground [&>div]:max-w-[440px] [&_input]:h-10 [&_input]:rounded-lg [&_input]:border-border [&_input]:bg-card [&_input]:text-sm [&_input]:text-foreground [&_input:read-only]:bg-background [&_input:read-only]:text-muted-foreground [&_small]:ml-1 [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"><span>Cover image URL <small>Optional</small></span><Input name="coverImage" type="url" placeholder="https://example.com/cover.jpg" /></label>
          <label className="my-[17px] grid gap-[7px] text-[13px] font-medium text-muted-foreground [&>div]:max-w-[440px] [&_input]:h-10 [&_input]:rounded-lg [&_input]:border-border [&_input]:bg-card [&_input]:text-sm [&_input]:text-foreground [&_input:read-only]:bg-background [&_input:read-only]:text-muted-foreground [&_small]:ml-1 [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"><span>Instructions</span><Textarea name="instructions" placeholder="How the app should use this integration" required /></label>
          <label className="my-[17px] grid gap-[7px] text-[13px] font-medium text-muted-foreground [&>div]:max-w-[440px] [&_input]:h-10 [&_input]:rounded-lg [&_input]:border-border [&_input]:bg-card [&_input]:text-sm [&_input]:text-foreground [&_input:read-only]:bg-background [&_input:read-only]:text-muted-foreground [&_small]:ml-1 [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"><span>Endpoints <small>JSON array</small></span><Textarea name="endpoints" className="min-h-[150px] font-mono text-xs" defaultValue="[]" spellCheck={false} required /></label>
          <label className="my-[17px] grid gap-[7px] text-[13px] font-medium text-muted-foreground [&>div]:max-w-[440px] [&_input]:h-10 [&_input]:rounded-lg [&_input]:border-border [&_input]:bg-card [&_input]:text-sm [&_input]:text-foreground [&_input:read-only]:bg-background [&_input:read-only]:text-muted-foreground [&_small]:ml-1 [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"><span>Authentication method</span><Input name="authMethod" placeholder="e.g. x-auth header" required /></label>
          <label className="my-[17px] grid gap-[7px] text-[13px] font-medium text-muted-foreground [&>div]:max-w-[440px] [&_input]:h-10 [&_input]:rounded-lg [&_input]:border-border [&_input]:bg-card [&_input]:text-sm [&_input]:text-foreground [&_input:read-only]:bg-background [&_input:read-only]:text-muted-foreground [&_small]:ml-1 [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground"><span>More details <small>Optional</small></span><Textarea name="moreDetails" placeholder="Additional setup or usage details" /></label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ec] pt-4">
            <span className="text-xs text-[#89928b]">Endpoint data is stored as JSONB.</span>
            <div className="flex gap-2"><Button type="button" variant="outlined" onClick={() => window.location.assign(withAppBasePath("/applications"))}>Cancel</Button><Button type="submit" variant="solid" disabled={pending}>{pending ? "Saving…" : <><Icon name="check" size={15} /> Save application</>}</Button></div>
          </div>
        </form>
      </div>
    </section>
  );
}
