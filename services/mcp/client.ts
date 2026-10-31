import "server-only";
import { getMcpRequestHeaders } from "@/services/mcp/headers";

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
};

export type McpEndpoint = { name: string; url: string };

type JsonRpcResponse = { result?: unknown; error?: { message?: string } };

/** Extracts unique absolute HTTP endpoints from an application's endpoint configuration. */
export function getApplicationMcpEndpoints(endpoints: unknown): McpEndpoint[] {
  const entries = Array.isArray(endpoints)
    ? endpoints.map((value, index) => [String(index + 1), value] as const)
    : endpoints && typeof endpoints === "object"
      ? Object.entries(endpoints as Record<string, unknown>)
      : [];
  const discovered = new Map<string, McpEndpoint>();
  for (const [key, value] of entries) {
    if (typeof value === "string") {
      addApplicationMcpEndpoint(discovered, key, value);
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const endpoint = value as Record<string, unknown>;
    const url = [endpoint.url, endpoint.endpoint, endpoint.endpointUrl, endpoint.baseUrl, endpoint.mcp].find((entry) => typeof entry === "string");
    if (typeof url !== "string") continue;
    const name = [endpoint.name, endpoint.label].find((entry) => typeof entry === "string");
    addApplicationMcpEndpoint(discovered, typeof name === "string" ? name : key, url);
  }
  return [...discovered.values()];
}

/** Adds one normalized HTTP(S) endpoint to the application's endpoint list. */
function addApplicationMcpEndpoint(endpoints: Map<string, McpEndpoint>, name: string, value: string) {
  try {
    const url = new URL(value.trim());
    if ((url.protocol === "https:" || url.protocol === "http:") && !endpoints.has(url.href)) endpoints.set(url.href, { name, url: url.href });
  } catch { /* Ignore malformed or relative endpoint values. */ }
}

/** Makes one authenticated JSON-RPC request to an MCP Streamable HTTP endpoint. */
async function requestMcp(endpoint: string, token: string, payload: Record<string, unknown>, sessionId?: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: getMcpRequestHeaders(endpoint, token, sessionId),
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`MCP endpoint returned HTTP ${response.status}.`);
  const responseText = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const jsonText = contentType.includes("text/event-stream")
    ? responseText.split(/\r?\n/).find((line) => line.startsWith("data:"))?.slice(5).trim()
    : responseText;
  if (!jsonText) throw new Error("MCP endpoint returned an empty response.");
  return { data: JSON.parse(jsonText) as JsonRpcResponse, sessionId: response.headers.get("MCP-Session-Id") ?? sessionId };
}

/** Discovers tools from any MCP Streamable HTTP endpoint using the account token. */
export async function discoverMcpTools(endpoint: string, token?: string | null): Promise<McpToolDefinition[]> {
  const authToken = token?.trim();
  if (!authToken) return [];
  const initialized = await requestMcp(endpoint, authToken, {
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "neup-assist", version: "0.1.0" } },
  });
  if (initialized.data.error) throw new Error(initialized.data.error.message ?? "MCP initialization failed.");
  const notice = await fetch(endpoint, {
    method: "POST",
    headers: getMcpRequestHeaders(endpoint, authToken, initialized.sessionId),
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!notice.ok) throw new Error(`MCP initialization notice returned HTTP ${notice.status}.`);
  const listed = await requestMcp(endpoint, authToken, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, initialized.sessionId);
  if (listed.data.error) throw new Error(listed.data.error.message ?? "MCP tool discovery failed.");
  const result = listed.data.result as { tools?: unknown } | undefined;
  if (!Array.isArray(result?.tools)) return [];
  return result.tools.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const tool = value as { name?: unknown; description?: unknown; inputSchema?: unknown };
    if (typeof tool.name !== "string" || !tool.inputSchema || typeof tool.inputSchema !== "object") return [];
    const schema = tool.inputSchema as { type?: unknown; properties?: unknown; required?: unknown };
    return [{
      name: tool.name,
      description: typeof tool.description === "string" ? tool.description : "MCP tool.",
      inputSchema: {
        type: "object" as const,
        properties: schema.properties && typeof schema.properties === "object" ? schema.properties as Record<string, unknown> : {},
        required: Array.isArray(schema.required) ? schema.required.filter((entry): entry is string => typeof entry === "string") : [],
      },
    }];
  });
}

/** Executes a named MCP tool against its source endpoint. */
export async function callMcpTool(endpoint: string, token: string, name: string, args: Record<string, unknown>) {
  const initialized = await requestMcp(endpoint, token, {
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "neup-assist", version: "0.1.0" } },
  });
  if (initialized.data.error) throw new Error(initialized.data.error.message ?? "MCP initialization failed.");
  const notice = await fetch(endpoint, {
    method: "POST",
    headers: getMcpRequestHeaders(endpoint, token, initialized.sessionId),
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!notice.ok) throw new Error(`MCP initialization notice returned HTTP ${notice.status}.`);
  const result = await requestMcp(endpoint, token, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }, initialized.sessionId);
  if (result.data.error) throw new Error(result.data.error.message ?? "MCP tool call failed.");
  return result.data.result ?? null;
}
