import { getPersonalLeads } from "@/services/context/personal.leads";
import type { ToolDefinition, ToolExecutionContext } from "./index";

export const estate_getMyLeadsDefinition: ToolDefinition = {
  name: "estate_getMyLeads",
  description: "Get estate leads visible to the signed-in user.",
  parameters: { type: "object", properties: {}, required: [] },
  format: "```neup.estate.lead.base\n{\"id\":\"leadId\",\"name\":\"leadName\",\"email\":\"leadEmail\",\"phone\":\"leadPhone\"}\n```",
  guidelines: "Use this format when sending the leads: {{format}}. Output one block per lead, include id and name, and omit optional fields without values. Add a short introduction before the first block and a concise closing after the last.",
};

/** Runs the personal leads context service. */
export function estate_getMyLeads({ authAccountToken }: ToolExecutionContext) {
  return getPersonalLeads(authAccountToken);
}
