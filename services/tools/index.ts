import "server-only";
import { personal_getBasics, personal_getBasicsDefinition } from "./personal_getBasics";
import { personal_getNotifications, personal_getNotificationsDefinition } from "./personal_getNotifications";
import { discoverRequirementsTools } from "@/services/mcp/requirements";

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
];

/** Ensures each model receives the tool-discovery declaration. */
export function includeToolDiscovery(tools: ToolDefinition[]) {
  return [app_discoverToolsDefinition, ...tools.filter((tool) => tool.name !== app_discoverToolsDefinition.name)];
}

/** Returns callable tools and their response formats without executing them. */
export function discoverContextTools() {
  return app_discoverTools(contextTools);
}

/** Includes authenticated requirements MCP tools in explicit tool discovery. */
async function discoverAvailableTools(authAccountToken?: string | null) {
  let requirementsTools: Awaited<ReturnType<typeof discoverRequirementsTools>> = [];
  try { requirementsTools = await discoverRequirementsTools(authAccountToken); } catch { /* Keep local tool discovery available when MCP is unavailable. */ }
  return [
    ...discoverContextTools(),
    ...requirementsTools.map((tool) => ({
      name: `requirements__${tool.name}`,
      description: tool.description,
      format: "JSON returned by the requirements MCP tool.",
      guidelines: "Use the returned requirements data to answer the user.",
    })),
  ];
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
    case "app_discoverTools": return discoverAvailableTools(authAccountToken);
    case "personal_getBasics": return personal_getBasics(context);
    case "personal_getNotifications": return personal_getNotifications(context);
    default: return Promise.reject(new Error(`Unknown context tool: ${name}`));
  }
}
