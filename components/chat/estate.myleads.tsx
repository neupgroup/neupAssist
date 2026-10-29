import { EstateBaseLead, type EstateLead } from "./estate.baselead";

/** Renders the signed-in user's leads in a chat reply. */
export function EstateMyLeads({ leads }: { leads: EstateLead[] }) {
  return <section className="estate-leads-group" aria-label="Your leads">
    {leads.map((lead) => <EstateBaseLead key={lead.id} lead={lead} />)}
  </section>;
}
