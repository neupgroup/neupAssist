import { getPersonalNotifications } from "@/services/context/personal.notifications";
import type { ToolDefinition, ToolExecutionContext } from "./index";

export const personal_getNotificationsDefinition: ToolDefinition = {
  name: "personal_getNotifications",
  description: "Get notifications for the signed-in user.",
  parameters: { type: "object", properties: {}, required: [] },
  format: "A concise list of notification titles and messages.",
  guidelines: "Use this format when showing notifications: {{format}}. Do not invent notification data.",
};

/** Runs the personal notifications context service. */
export function personal_getNotifications({ authAccountToken }: ToolExecutionContext) {
  return getPersonalNotifications(authAccountToken);
}
