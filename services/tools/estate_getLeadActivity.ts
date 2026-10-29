import "server-only";
import { runApi } from "@neup/core/infrastructure/api";
import { getBaseUrl } from "@neup/logica/baseurl";
import type { ToolDefinition, ToolExecutionContext } from "./index";

export const estate_getLeadActivityDefinition: ToolDefinition = {
  name: "estate_getLeadActivity",
  description: "Get the activity timeline for an estate lead. Supply the lead ID.",
  parameters: {
    type: "object",
    properties: { leadId: { type: "string", description: "ID of the estate lead." } },
    required: ["leadId"],
  },
  format: "A JSON array of lead activity entries with activity date, type, remarks, and actor when available.",
  guidelines: "Present activities in chronological order. Include only fields returned by the service.",
};

/** Gets the activity timeline for one estate lead. */
export function estate_getLeadActivity({ authAccountToken, arguments: toolArguments = {} }: ToolExecutionContext) {
  const leadId = toolArguments.leadId;
  if (typeof leadId !== "string" || !leadId.trim()) throw new Error("A leadId is required to get lead activity.");
  const accountToken = authAccountToken?.trim();
  if (!accountToken) throw new Error("An authenticated account is required to get lead activity.");
  return runApi({
    baseUrl: getBaseUrl("estate"),
    path: `bridge/api.v1/leads/${encodeURIComponent(leadId.trim())}/activity`,
    method: "GET",
    headers: { "x-auth": accountToken },
  });
}
