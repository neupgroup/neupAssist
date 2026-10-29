import { getPersonalListings } from "@/services/context/personal.listings";
import type { ToolDefinition, ToolExecutionContext } from "./index";

export const estate_getMyListingsDefinition: ToolDefinition = {
  name: "estate_getMyListings",
  description: "Get estate properties listed by the signed-in user.",
  parameters: { type: "object", properties: {}, required: [] },
  format: "```neup.estate.property.saved\n{\"propertyId\":\"propertyId\",\"title\":\"propertyTitle\",\"price\":\"price\",\"location\":\"location\",\"type\":\"propertyType\",\"image\":\"imageUrl\"}\n```",
  guidelines: "Use this format when showing listings: {{format}}. Output one block per property and include only fields present in the data.",
};

/** Runs the personal listings context service. */
export function estate_getMyListings({ authAccountToken }: ToolExecutionContext) {
  return getPersonalListings(authAccountToken);
}
