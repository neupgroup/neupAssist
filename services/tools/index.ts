import "server-only";
import { prisma } from "@neup/core/database/prisma";
import { ensureAccount } from "@neup/shared/account/self";
import { discoverMcpTools, getApplicationMcpEndpoints } from "@/services/mcp/client";
import { personal_getBasics, personal_getBasicsDefinition } from "./personal_getBasics";
import { personal_getNotifications, personal_getNotificationsDefinition } from "./personal_getNotifications";

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required: string[] };
  format: string;
  guidelines: string;
};

export type ToolCall = { id: string; name: string; arguments: Record<string, unknown> };

export type ToolExecutionContext = { authAccountToken?: string | null; arguments?: Record<string, unknown> };

const directNiaBlockGuideline = 'If application data contains a complete <nia block="name">...</nia> element, preserve the element and its contents verbatim. Do not summarize, rewrite, or convert its contents to Markdown unless the user explicitly asks for that conversion.';

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

/** Includes tools from every active application integration in explicit discovery. */
async function discoverAvailableTools(authAccountToken?: string | null) {
  const account = await ensureAccount(authAccountToken).catch(() => null);
  const integrations = account ? await prisma.integration.findMany({
    where: { account_id: account.id, status: "active" },
    select: { application: { select: { id: true, name: true, endpoints: true } } },
    orderBy: { addedOn: "desc" },
  }).catch(() => []) : [];
  const applications = new Map<string, { id: string; name: string; endpoints: ReturnType<typeof getApplicationMcpEndpoints> }>();
  for (const { application } of integrations) {
    if (!applications.has(application.id)) applications.set(application.id, { id: application.id, name: application.name, endpoints: getApplicationMcpEndpoints(application.endpoints) });
  }
  const discovered = await Promise.all([...applications.values()].flatMap((application) => application.endpoints.map(async (endpoint) => {
    try { return { application, tools: await discoverMcpTools(endpoint.url, authAccountToken) }; }
    catch { return { application, tools: [] as Awaited<ReturnType<typeof discoverMcpTools>> }; }
  })));
  const externalTools = discovered.flatMap(({ application, tools }) => tools.map((tool) => ({ application, tool })));
  const usedNames = new Set<string>();
  return [
    ...discoverContextTools(),
    ...externalTools.map(({ application, tool }, index) => {
      let name = `application__${tool.name}`;
      if (usedNames.has(name)) name = `application__${application.name.replace(/[^a-zA-Z0-9]/g, "_")}__${tool.name}`;
      if (usedNames.has(name)) name = `${name}__${index + 1}`;
      usedNames.add(name);
      return {
        name,
        description: `${application.name}: ${tool.description}`,
        format: `Structured data returned by ${application.name}; summarize it in readable Markdown, never raw JSON, except preserve any complete nia block verbatim.`,
        guidelines: `${directNiaBlockGuideline} Summarize other returned ${application.name} data in clear, presentable Markdown. For structured records such as leads, properties, cards, or contacts, use readable Markdown headings and lists. Generate HTML outside nia blocks only when the user explicitly requests HTML. Use Markdown tables when requested or useful for comparison. Never output raw JSON or JSON syntax except when it is inside a preserved nia block. Preserve returned facts, say when requested information is absent, and do not invent details. Show phone numbers as Markdown links such as [phone](tel:+15551234567) and emails as Markdown links such as [email@example.com](mailto:email@example.com).`,
      };
    }),
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
