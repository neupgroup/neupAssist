import "server-only";

const requirementsEndpoint = "https://neupgroup.com/estate/bridge/mcp.v1/requirements";

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
};

type JsonRpcResponse = { result?: unknown; error?: { message?: string } };

/** Reads an MCP JSON-RPC response in JSON or server-sent event form. */
async function readMcpResponse(response: Response): Promise<JsonRpcResponse> {
  const text = await response.text();
  if ((response.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = text.split(/\r?\n/).find((line) => line.startsWith("data:"))?.slice(5).trim();
    if (!data) throw new Error("MCP endpoint returned an empty event stream.");
    return JSON.parse(data) as JsonRpcResponse;
  }
  return JSON.parse(text) as JsonRpcResponse;
}

/** Makes one authenticated JSON-RPC request to the requirements MCP server. */
async function requestMcp(endpoint: string, token: string, payload: Record<string, unknown>, sessionId?: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "x-auth": token,
      ...(sessionId ? { "MCP-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`MCP endpoint returned HTTP ${response.status}.`);
  return { data: await readMcpResponse(response), sessionId: response.headers.get("MCP-Session-Id") ?? sessionId };
}

/** Discovers tools from an MCP Streamable HTTP endpoint using the account token. */
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
    headers: {
      Accept: "application/json, text/event-stream", "Content-Type": "application/json", "x-auth": authToken,
      ...(initialized.sessionId ? { "MCP-Session-Id": initialized.sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!notice.ok) throw new Error(`MCP initialization notice returned HTTP ${notice.status}.`);

  const listed = await requestMcp(endpoint, authToken, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, initialized.sessionId);
  if (listed.data.error) throw new Error(listed.data.error.message ?? "MCP tool discovery failed.");
  const result = listed.data.result as { tools?: unknown } | undefined;
  if (!Array.isArray(result?.tools)) return [];
  return result.tools.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const tool = value as { name?: unknown; description?: unknown; inputSchema?: unknown };
    const schema = tool.inputSchema;
    if (typeof tool.name !== "string" || !schema || typeof schema !== "object") return [];
    const inputSchema = schema as { type?: unknown; properties?: unknown; required?: unknown };
    return [{
      name: tool.name,
      description: typeof tool.description === "string" ? tool.description : "Requirements MCP tool.",
      inputSchema: {
        type: "object" as const,
        properties: inputSchema.properties && typeof inputSchema.properties === "object" ? inputSchema.properties as Record<string, unknown> : {},
        required: Array.isArray(inputSchema.required) ? inputSchema.required.filter((entry): entry is string => typeof entry === "string") : [],
      },
    }];
  });
}

/** Discovers tools from the requirements MCP server. */
export async function discoverRequirementsTools(token?: string | null): Promise<McpToolDefinition[]> {
  return discoverMcpTools(requirementsEndpoint, token);
}

/** Executes a requirements MCP tool with the current authenticated account. */
export async function callRequirementsTool(token: string, name: string, args: Record<string, unknown>) {
  const initialized = await requestMcp(requirementsEndpoint, token, {
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "neup-assist", version: "0.1.0" } },
  });
  if (initialized.data.error) throw new Error(initialized.data.error.message ?? "Requirements MCP initialization failed.");
  const notice = await fetch(requirementsEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream", "Content-Type": "application/json", "x-auth": token,
      ...(initialized.sessionId ? { "MCP-Session-Id": initialized.sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!notice.ok) throw new Error(`Requirements MCP initialization notice returned HTTP ${notice.status}.`);

  const result = await requestMcp(requirementsEndpoint, token, {
    jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args },
  }, initialized.sessionId);
  if (result.data.error) throw new Error(result.data.error.message ?? "Requirements MCP tool call failed.");
  return result.data.result ?? null;
}
