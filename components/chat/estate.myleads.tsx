import { EstateBaseLead, type EstateLead } from "./estate.baselead";

/** Renders the signed-in user's leads in a chat reply. */
export function EstateMyLeads({ leads }: { leads: EstateLead[] }) {
  return <section className="my-[10px] grid gap-[9px] [&>button]:mb-0" aria-label="Your leads">
    {leads.map((lead) => <EstateBaseLead key={lead.id} lead={lead} />)}
  </section>;
}
