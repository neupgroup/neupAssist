import { EstateBaseLead, type EstateLead } from "./estate.baselead";

/** Renders team leads in a chat reply. */
export function EstateTeamLeads({ leads }: { leads: EstateLead[] }) {
  return <section className="estate-leads-group" aria-label="Team leads">
    {leads.map((lead) => <EstateBaseLead key={lead.id} lead={lead} />)}
  </section>;
}
