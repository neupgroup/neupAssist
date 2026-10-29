import "server-only";
import { personal_getBasics, personal_getBasicsDefinition } from "./personal_getBasics";
import { personal_getNotifications, personal_getNotificationsDefinition } from "./personal_getNotifications";
import { estate_getMyLeads, estate_getMyLeadsDefinition } from "./estate_getMyLeads";
import { estate_getMyListings, estate_getMyListingsDefinition } from "./estate_getMyListings";
import { estate_getFavourites, estate_getFavouritesDefinition } from "./estate_getFavourites";
import { estate_getLeadActivity, estate_getLeadActivityDefinition } from "./estate_getLeadActivity";
import { estate_postLeadActivity, estate_postLeadActivityDefinition } from "./estate_postLeadActivity";

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required: string[] };
  format: string;
  guidelines: string;
};

export type ToolCall = { id: string; name: string; arguments: Record<string, unknown> };

export type ToolExecutionContext = { authAccountToken?: string | null; arguments?: Record<string, unknown> };

/** Defines the tool discovery entry sent to models. */
export const app_discoverToolsDefinition: ToolDefinition = {
  name: "app_discoverTools",
  description: "Discover the tools available to the application. Call this when the user asks for information the application's current tools do not provide. The available tools are declared in this request; choose a suitable one if present.",
  parameters: { type: "object", properties: {}, required: [] },
  format: "A JSON array of available tools, each with a name, description, format, and guidelines.",
  guidelines: "Use a discovered tool only if it is also available in the current tool declarations.",
};

/** Lists registered tools without calling any of them. */
export function app_discoverTools(tools: ToolDefinition[]) {
  return tools
    .filter((tool) => tool.name !== app_discoverToolsDefinition.name)
    .map(({ name, description, format, guidelines }) => ({ name, description, format, guidelines }));
}

/** Lists every callable tool available to the model. */
export const contextTools: ToolDefinition[] = [
  app_discoverToolsDefinition,
  personal_getBasicsDefinition,
  personal_getNotificationsDefinition,
  estate_getMyLeadsDefinition,
  estate_getMyListingsDefinition,
  estate_getFavouritesDefinition,
  estate_getLeadActivityDefinition,
  estate_postLeadActivityDefinition,
];

/** Ensures each model receives the tool-discovery declaration. */
export function includeToolDiscovery(tools: ToolDefinition[]) {
  return [app_discoverToolsDefinition, ...tools.filter((tool) => tool.name !== app_discoverToolsDefinition.name)];
}

/** Returns callable tools and their response formats without executing them. */
export function discoverContextTools() {
  return app_discoverTools(contextTools);
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

/** Runs one declared context tool using its existing service function. */
export function executeContextTool({ name, authAccountToken, arguments: toolArguments }: { name: string; authAccountToken?: string | null; arguments?: Record<string, unknown> }): Promise<unknown> {
  const context: ToolExecutionContext = { authAccountToken, arguments: toolArguments };
  switch (name) {
    case "app_discoverTools": return Promise.resolve(discoverContextTools());
    case "personal_getBasics": return personal_getBasics(context);
    case "personal_getNotifications": return personal_getNotifications(context);
    case "estate_getMyLeads": return estate_getMyLeads(context);
    case "estate_getMyListings": return estate_getMyListings(context);
    case "estate_getFavourites": return estate_getFavourites(context);
    case "estate_getLeadActivity": return estate_getLeadActivity(context);
    case "estate_postLeadActivity": return estate_postLeadActivity(context);
    default: return Promise.reject(new Error(`Unknown context tool: ${name}`));
  }
}
