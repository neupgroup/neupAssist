import "server-only";
import { getPersonalBasics } from "@/services/context/personal.basics";
import { getPersonalNotifications } from "@/services/context/personal.notifications";
import { getPersonalLeads } from "@/services/context/personal.leads";
import { getPersonalListings } from "@/services/context/personal.listings";
import { getPersonalSavedProperties } from "@/services/context/personal.saved-properties";

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, never>; required: string[] };
  format: string;
  guidelines: string;
};

export type ToolCall = { id: string; name: string; arguments: Record<string, unknown> };

/** Provides tool discovery even when a provider request uses a reduced tool set. */
export const toolDiscovery: ToolDefinition = {
  name: "discover_context_tools",
  description: "Discover the tools available to the application. Call this when the user asks for information the application's current context tools do not provide, then use a suitable discovered tool if one is available.",
  parameters: { type: "object", properties: {}, required: [] },
  format: "A JSON array of available tools, each with a name, description, format, and guidelines.",
  guidelines: "Use a discovered tool only if it is also available in the current tool declarations.",
};

/** Defines the context lookups that models may request during a chat. */
export const contextTools: ToolDefinition[] = [
  toolDiscovery,
  {
    name: "get_personal_basics",
    description: "Get the signed-in user's basic profile details.",
    parameters: { type: "object", properties: {}, required: [] },
    format: "```neup.personal.basics\n{\"displayName\":\"{{displayName}}\",\"displayImage\":\"{{displayImage}}\",\"neupid\":\"{{neupid}}\"}\n```",
    guidelines: "Use this format when showing the user's profile: {{format}}. Omit fields that are null.",
  },
  {
    name: "get_personal_notifications",
    description: "Get notifications for the signed-in user.",
    parameters: { type: "object", properties: {}, required: [] },
    format: "A concise list of notification titles and messages.",
    guidelines: "Use this format when showing notifications: {{format}}. Do not invent notification data.",
  },
  {
    name: "get_personal_leads",
    description: "Get estate leads visible to the signed-in user.",
    parameters: { type: "object", properties: {}, required: [] },
    format: "```neup.estate.lead.base\n{\"id\":\"leadId\",\"name\":\"leadName\",\"email\":\"leadEmail\",\"phone\":\"leadPhone\"}\n```",
    guidelines: "Use this format when sending the leads: {{format}}. Output one block per lead, include id and name, and omit optional fields without values. Add a short introduction before the first block and a concise closing after the last.",
  },
  {
    name: "get_personal_listings",
    description: "Get estate properties listed by the signed-in user.",
    parameters: { type: "object", properties: {}, required: [] },
    format: "```neup.estate.property.saved\n{\"propertyId\":\"propertyId\",\"title\":\"propertyTitle\",\"price\":\"price\",\"location\":\"location\",\"type\":\"propertyType\",\"image\":\"imageUrl\"}\n```",
    guidelines: "Use this format when showing listings: {{format}}. Output one block per property and include only fields present in the data.",
  },
  {
    name: "get_personal_saved_properties",
    description: "Get properties saved by the signed-in user.",
    parameters: { type: "object", properties: {}, required: [] },
    format: "```neup.estate.property.saved\n{\"propertyId\":\"propertyId\",\"title\":\"propertyTitle\",\"price\":\"price\",\"location\":\"location\",\"type\":\"propertyType\",\"image\":\"imageUrl\"}\n```",
    guidelines: "Use this format when showing saved properties: {{format}}. Output one block per property and include only fields present in the data.",
  },
];

/** Ensures each model receives the tool-discovery declaration. */
export function includeToolDiscovery(tools: ToolDefinition[]) {
  return [toolDiscovery, ...tools.filter((tool) => tool.name !== toolDiscovery.name)];
}

/** Returns callable context tools without invoking any context service. */
export function discoverContextTools() {
  return contextTools
    .filter((tool) => tool.name !== "discover_context_tools")
    .map(({ name, description, format, guidelines }) => ({ name, description, format, guidelines }));
}

/** Adds a tool's response format and rendered guidelines to its result. */
export function formatToolResult({ name, data }: { name: string; data: unknown }) {
  const definition = contextTools.find((tool) => tool.name === name);
  if (!definition) throw new Error(`Unknown context tool: ${name}`);
  return {
    name,
    data,
    format: definition.format,
    guidelines: definition.guidelines.replaceAll("{{format}}", definition.format),
  };
}

/** Runs a declared context tool using the same services used by contextManager. */
export async function executeContextTool({ name, authAccountToken }: { name: string; authAccountToken?: string | null }): Promise<unknown> {
  switch (name) {
    case "discover_context_tools": return discoverContextTools();
    case "get_personal_basics": return getPersonalBasics(authAccountToken);
    case "get_personal_notifications": return getPersonalNotifications(authAccountToken);
    case "get_personal_leads": return getPersonalLeads(authAccountToken);
    case "get_personal_listings": return getPersonalListings(authAccountToken);
    case "get_personal_saved_properties": return getPersonalSavedProperties(authAccountToken);
    default: throw new Error(`Unknown context tool: ${name}`);
  }
}
