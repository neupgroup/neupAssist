import { getPersonalSavedProperties } from "@/services/context/personal.saved-properties";
import type { ToolDefinition, ToolExecutionContext } from "./index";

export const estate_getFavouritesDefinition: ToolDefinition = {
  name: "estate_getFavourites",
  description: "Get properties saved by the signed-in user.",
  parameters: { type: "object", properties: {}, required: [] },
  format: "```neup.estate.property.saved\n{\"propertyId\":\"propertyId\",\"title\":\"propertyTitle\",\"price\":\"price\",\"location\":\"location\",\"type\":\"propertyType\",\"image\":\"imageUrl\"}\n```",
  guidelines: "Use this format when showing saved properties: {{format}}. Output one block per property and include only fields present in the data.",
};

/** Runs the personal saved properties context service. */
export function estate_getFavourites({ authAccountToken }: ToolExecutionContext) {
  return getPersonalSavedProperties(authAccountToken);
}
