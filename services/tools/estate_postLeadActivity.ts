import "server-only";
import { runApi } from "@neup/core/infrastructure/api";
import { getBaseUrl } from "@neup/logica/baseurl";
import type { EstateLeadActivityInput } from "@neup/logica/estate/lead";
import type { ToolDefinition, ToolExecutionContext } from "./index";

export const estate_postLeadActivityDefinition: ToolDefinition = {
  name: "estate_postLeadActivity",
  description: "Add an activity to an estate lead. Supply the lead ID, activity type, and remarks. Use only when the user asks to record an activity.",
  parameters: {
    type: "object",
    properties: {
      leadId: { type: "string", description: "ID of the estate lead." },
      activityType: { type: "string", enum: ["follow_up", "visit", "meeting", "remarks"] },
      activityOn: { type: "string", description: "Optional activity date/time in ISO 8601 format." },
      followUpMethod: { type: "string", enum: ["phone call", "whatsapp", "email"] },
      propertyId: { type: "string", description: "Optional related property ID." },
      remarks: { type: "string", description: "Notes describing the activity." },
    },
    required: ["leadId", "activityType", "remarks"],
  },
  format: "```neup.estate.activity.confirmation\n{\"leadId\":\"leadId\",\"activityType\":\"activityType\",\"followUpMethod\":\"followUpMethod\",\"remarks\":\"remarks\",\"activityOn\":\"activityOn\"}\n```",
  guidelines: "After the service confirms success, return the created activity details in this format: {{format}}. Include only fields present in the created activity. Do not emit this block if the request failed.",
};

/** Posts a validated activity to one estate lead. */
export function estate_postLeadActivity({ authAccountToken, arguments: toolArguments = {} }: ToolExecutionContext) {
  const leadId = toolArguments.leadId;
  const activityType = toolArguments.activityType;
  const remarks = toolArguments.remarks;
  const followUpMethod = toolArguments.followUpMethod;
  const activityOn = toolArguments.activityOn;
  const propertyId = toolArguments.propertyId;
  if (typeof leadId !== "string" || !leadId.trim()) throw new Error("A leadId is required to post lead activity.");
  if (activityType !== "follow_up" && activityType !== "visit" && activityType !== "meeting" && activityType !== "remarks") throw new Error("A valid activityType is required.");
  if (typeof remarks !== "string" || !remarks.trim()) throw new Error("Activity remarks are required.");
  if (followUpMethod !== undefined && followUpMethod !== "phone call" && followUpMethod !== "whatsapp" && followUpMethod !== "email") throw new Error("A valid followUpMethod is required.");
  if (activityOn !== undefined && typeof activityOn !== "string") throw new Error("activityOn must be an ISO 8601 date string.");
  if (propertyId !== undefined && typeof propertyId !== "string") throw new Error("propertyId must be a string.");
  const accountToken = authAccountToken?.trim();
  if (!accountToken) throw new Error("An authenticated account is required to post lead activity.");

  const activity: EstateLeadActivityInput = {
    activityType,
    remarks: remarks.trim(),
    ...(typeof activityOn === "string" ? { activityOn } : {}),
    ...(typeof followUpMethod === "string" ? { followUpMethod } : {}),
    ...(typeof propertyId === "string" ? { propertyId } : {}),
  };
  return runApi({
    baseUrl: getBaseUrl("estate"),
    path: `bridge/api.v1/leads/${encodeURIComponent(leadId.trim())}/activity`,
    method: "POST",
    headers: { "x-auth": accountToken },
    body: activity,
  });
}
