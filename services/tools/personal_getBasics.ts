import { getPersonalBasics } from "@/services/context/personal.basics";
import type { ToolDefinition, ToolExecutionContext } from "./index";

export const personal_getBasicsDefinition: ToolDefinition = {
  name: "personal_getBasics",
  description: "Get the signed-in user's basic profile details.",
  parameters: { type: "object", properties: {}, required: [] },
  format: "```neup.personal.basics\n{\"displayName\":\"{{displayName}}\",\"displayImage\":\"{{displayImage}}\",\"neupid\":\"{{neupid}}\"}\n```",
  guidelines: "Use this format when showing the user's profile: {{format}}. Omit fields that are null.",
};

/** Runs the personal basics context service. */
export function personal_getBasics({ authAccountToken }: ToolExecutionContext) {
  return getPersonalBasics(authAccountToken);
}
