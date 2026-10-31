import { contextTools, app_discoverToolsDefinition } from "@/services/tools";
import { getCookie } from "@neup/core/helpers/cookie";

const mcpEndpoints = [
  { name: "Estate MCP", url: "https://neupgroup.com/estate/bridge/mcp.v1" },
  { name: "Estate Properties MCP", url: "https://neupgroup.com/estate/bridge/mcp.v1/properties" },
  { name: "Estate Requirements MCP", url: "https://neupgroup.com/estate/bridge/mcp.v1/requirements" },
];

type JsonRpcResponse = { result?: unknown; error?: { message?: string } };
type McpServerTools = { name: string; url: string; tools: Array<Record<string, unknown>>; error?: string };

/** Reads a JSON-RPC response returned as JSON or a server-sent event stream. */
async function readMcpResponse(response: Response): Promise<JsonRpcResponse> {
  const responseText = await response.text();
  if ((response.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = responseText.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .find(Boolean);
    if (!data) throw new Error("MCP server returned an empty event stream.");
    return JSON.parse(data) as JsonRpcResponse;
  }
  return JSON.parse(responseText) as JsonRpcResponse;
}

/** Sends one MCP JSON-RPC request and returns its response and session ID. */
async function sendMcpRequest(endpoint: string, payload: Record<string, unknown>, authAccountToken: string, sessionId?: string) {
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "x-auth": authAccountToken,
  };
  if (sessionId) headers["MCP-Session-Id"] = sessionId;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`MCP server returned HTTP ${response.status}.`);
  return {
    data: await readMcpResponse(response),
    sessionId: response.headers.get("MCP-Session-Id") ?? sessionId,
  };
}

/** Discovers tool definitions exposed by an MCP Streamable HTTP endpoint. */
async function discoverMcpTools(endpoint: string, authAccountToken: string): Promise<Array<Record<string, unknown>>> {
  const initialized = await sendMcpRequest(endpoint, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "neup-assist", version: "0.1.0" },
    },
  }, authAccountToken);
  if (initialized.data.error) throw new Error(initialized.data.error.message ?? "MCP initialization failed.");

  const initializedNotice = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "x-auth": authAccountToken,
      ...(initialized.sessionId ? { "MCP-Session-Id": initialized.sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!initializedNotice.ok) throw new Error(`MCP initialization notice returned HTTP ${initializedNotice.status}.`);

  const listed = await sendMcpRequest(endpoint, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  }, authAccountToken, initialized.sessionId);
  if (listed.data.error) throw new Error(listed.data.error.message ?? "MCP tool discovery failed.");
  const result = listed.data.result as { tools?: unknown } | undefined;
  return Array.isArray(result?.tools)
    ? result.tools.filter((tool): tool is Record<string, unknown> => Boolean(tool) && typeof tool === "object" && !Array.isArray(tool))
    : [];
}

/** Loads tools from one configured MCP server and keeps errors visible on the page. */
async function loadMcpServer({ name, url }: { name: string; url: string }, authAccountToken: string): Promise<McpServerTools> {
  try {
    return { name, url, tools: await discoverMcpTools(url, authAccountToken) };
  } catch (error) {
    return {
      name,
      url,
      tools: [],
      error: error instanceof Error ? error.message : "Could not discover MCP tools.",
    };
  }
}

/** Formats MCP input schemas for a readable page. */
function formatInputSchema(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

/** Renders a readable inventory of application tools and connected MCP tools. */
export default async function ToolsPage() {
  const localTools = contextTools.filter((tool) => tool.name !== app_discoverToolsDefinition.name);
  const authAccountToken = (await getCookie("auth_account"))?.trim();
  const mcpServers = authAccountToken
    ? await Promise.all(mcpEndpoints.map((server) => loadMcpServer(server, authAccountToken)))
    : mcpEndpoints.map(({ name, url }) => ({ name, url, tools: [], error: "Sign in to discover tools from this server." }));

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-[#fbfcfa] px-5 py-10 text-[#344139] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <p className="mb-2 text-xs font-bold tracking-[.13em] text-[#77917a]">DEVELOPER REFERENCE</p>
          <h1 className="m-0 text-4xl font-medium tracking-[-.055em] text-[#26332c]">Available tools</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#818b83]">Tools available to this app, including tools discovered from its configured MCP servers.</p>
        </header>

        <section aria-labelledby="app-tools-heading" className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="app-tools-heading" className="m-0 text-lg font-semibold text-[#3c4940]">Application tools</h2>
            <span className="rounded-md bg-[#edf4ec] px-2 py-1 text-xs font-semibold text-[#5b8062]">{localTools.length}</span>
          </div>
          <div className="grid gap-3">
            {localTools.map((tool) => (
              <article key={tool.name} className="rounded-xl border border-[#e6ebe4] bg-white p-5">
                <h3 className="m-0 font-mono text-sm font-semibold text-[#52785e]">{tool.name}</h3>
                <p className="mb-0 mt-2 text-sm leading-6 text-[#69756c]">{tool.description}</p>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-[#637c67]">Input schema</summary>
                  <pre className="mt-3 overflow-auto rounded-lg bg-[#f7f9f6] p-4 text-xs leading-5 text-[#536358]"><code>{formatInputSchema(tool.parameters)}</code></pre>
                </details>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="mcp-tools-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="mcp-tools-heading" className="m-0 text-lg font-semibold text-[#3c4940]">MCP servers</h2>
            <span className="text-xs text-[#818b83]">Discovered at page load</span>
          </div>
          <div className="grid gap-4">
            {mcpServers.map((server) => (
              <article key={server.url} className="rounded-xl border border-[#e6ebe4] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="m-0 text-base font-semibold text-[#3c4940]">{server.name}</h3>
                    <a className="mt-1 inline-block break-all font-mono text-xs text-[#738177] underline decoration-[#d5ddd4] underline-offset-2" href={server.url}>{server.url}</a>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${server.error ? "bg-[#fff2ed] text-[#9b614c]" : "bg-[#edf4ec] text-[#5b8062]"}`}>
                    {server.error ? "Unavailable" : `${server.tools.length} tools`}
                  </span>
                </div>
                {server.error ? (
                  <p className="mb-0 mt-4 text-sm text-[#986750]">Could not load tools: {server.error}</p>
                ) : server.tools.length ? (
                  <ul className="mb-0 mt-4 grid gap-3 pl-5">
                    {server.tools.map((tool, index) => (
                      <li key={`${String(tool.name ?? "tool")}-${index}`}>
                        <strong className="font-mono text-sm text-[#52785e]">{String(tool.name ?? "Unnamed tool")}</strong>
                        {typeof tool.description === "string" && <p className="mb-0 mt-1 text-sm leading-6 text-[#69756c]">{tool.description}</p>}
                        {tool.inputSchema !== undefined && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm font-medium text-[#637c67]">Input schema</summary>
                            <pre className="mt-3 overflow-auto rounded-lg bg-[#f7f9f6] p-4 text-xs leading-5 text-[#536358]"><code>{formatInputSchema(tool.inputSchema)}</code></pre>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : <p className="mb-0 mt-4 text-sm text-[#818b83]">No tools were returned by this server.</p>}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
