import Link from "next/link";
import { notFound } from "next/navigation";
import { getCookie } from "@neup/core/helpers/cookie";
import { prisma } from "@neup/core/database/prisma";
import { ensureAccount } from "@neup/shared/account/self";
import { discoverMcpTools, type McpToolDefinition } from "@/services/mcp/client";
import { connectApplication } from "./connect-action";

export const dynamic = "force-dynamic";

type McpEndpointEntry = { name: string; url: string; tools: McpToolDefinition[]; error?: string };

/** Turns an MCP function identifier into a readable title. */
function formatActionName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** Extracts absolute MCP endpoint URLs from the application's JSONB endpoint list. */
function getMcpEndpoints(endpoints: unknown): Array<{ name: string; url: string }> {
  const entries = Array.isArray(endpoints)
    ? endpoints.map((value, index) => [String(index + 1), value] as const)
    : endpoints && typeof endpoints === "object"
      ? Object.entries(endpoints as Record<string, unknown>)
      : [];
  const discovered = new Map<string, { name: string; url: string }>();

  for (const [key, value] of entries) {
    if (typeof value === "string") {
      addMcpEndpoint(discovered, key, value);
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const endpoint = value as Record<string, unknown>;
    const url = [endpoint.url, endpoint.endpoint, endpoint.endpointUrl, endpoint.baseUrl, endpoint.mcp]
      .find((entry) => typeof entry === "string");
    if (typeof url !== "string") continue;
    const name = [endpoint.name, endpoint.label].find((entry) => typeof entry === "string");
    addMcpEndpoint(discovered, typeof name === "string" ? name : key, url);
  }

  return [...discovered.values()];
}

/** Adds a unique absolute HTTP endpoint from the application's endpoint list. */
function addMcpEndpoint(endpoints: Map<string, { name: string; url: string }>, name: string, value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return;
    if (!endpoints.has(url.href)) endpoints.set(url.href, { name, url: url.href });
  } catch {
    // Ignore malformed and relative endpoint values.
  }
}

/** Loads an application and its integrations for the signed-in account. */
async function loadApplication(id: string) {
  try {
    const authAccountToken = await getCookie("auth_account");
    const account = await ensureAccount(authAccountToken);
    const application = await prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        instructions: true,
        endpoints: true,
        authMethod: true,
        moreDetails: true,
        displayImage: true,
        coverImage: true,
        _count: { select: { integrations: true } },
        integrations: {
          where: { account_id: account?.id ?? "" },
          select: { id: true, status: true, addedOn: true },
          orderBy: { addedOn: "desc" },
        },
      },
    });
    const mcpEndpoints = application ? getMcpEndpoints(application.endpoints) : [];
    const mcpServers = await Promise.all(mcpEndpoints.map(async (endpoint): Promise<McpEndpointEntry> => {
      if (!authAccountToken?.trim()) return { ...endpoint, tools: [], error: "Sign in to discover MCP functions." };
      try {
        return { ...endpoint, tools: await discoverMcpTools(endpoint.url, authAccountToken) };
      } catch (error) {
        return { ...endpoint, tools: [], error: error instanceof Error ? error.message : "Could not discover MCP functions." };
      }
    }));
    const isConnected = Boolean(application?.integrations.some((integration) => integration.status === "active"));
    return { application, mcpServers, isConnected, error: false };
  } catch {
    return { application: null, mcpServers: [], isConnected: false, error: true };
  }
}

/** Renders details for one application catalog entry. */
export default async function ApplicationDetailsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ connect?: string; connected?: string }> }) {
  const { id: rawId } = await params;
  const query = await searchParams;
  const applicationId = rawId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId)) notFound();

  const { application, mcpServers, isConnected, error } = await loadApplication(applicationId);
  if (!application && !error) notFound();

  return (
    <section className="keys-page">
      <header className="topbar">
        <div className="breadcrumb"><Link href="/apps">Apps and Integrations</Link><span className="crumb-slash">/</span><strong>{application?.name ?? "Application"}</strong></div>
        <div className="flex items-center gap-4">
          <Link href={`/apps/${application?.id}/edit`} className="text-sm text-[#738177] hover:text-[#365e45]">Edit application</Link>
          <Link href="/apps" className="text-sm text-[#738177] hover:text-[#365e45]">Back to apps</Link>
        </div>
      </header>
      <div className="keys-content">
        {error || !application ? (
          <div className="api-card keys-empty" role="status">Could not load this application. Check the database and try again.</div>
        ) : (
          <>
            <div className="page-intro">
              {application.coverImage && <img src={application.coverImage} alt="" className="mb-5 h-44 w-full rounded-xl object-cover" />}
              <div className="flex items-center gap-3">{application.displayImage ? <img src={application.displayImage} alt="" className="h-12 w-12 rounded-xl border border-[#e4eae1] object-cover" /> : <div className="page-icon"><span aria-hidden="true" className="text-lg">⌘</span></div>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h1>{application.name}</h1>
                <span className="rounded-full bg-[#edf4ec] px-3 py-1 text-xs font-semibold text-[#5b8062]">{application.category}</span>
              </div>
              <p className="page-description">{application.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {isConnected ? (
                  <span className="rounded-lg border border-[#dce8dc] bg-[#edf4ec] px-4 py-2 text-sm font-semibold text-[#52785e]">Connected</span>
                ) : (
                  <form action={connectApplication}>
                    <input type="hidden" name="applicationId" value={application.id} />
                    <button type="submit" className="rounded-lg bg-[#52785e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#456b51]">Connect to application</button>
                  </form>
                )}
                {query.connect === "signin" && <p className="m-0 text-sm text-[#986750]" role="status">Sign in to connect this application.</p>}
                {query.connected === "1" && <p className="m-0 text-sm text-[#52785e]" role="status">Application connected to your account.</p>}
              </div>
            </div>

            <section className="mt-4" aria-labelledby="application-mcp-heading">
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <h2 id="application-mcp-heading" className="mb-0 text-2xl font-semibold text-[#354a39]">Available actions</h2>
                  <span className="key-count">{mcpServers.reduce((count, server) => count + server.tools.length, 0)}</span>
                </div>
                <p className="mb-0 mt-2 text-sm leading-6 text-[#69756c]">Actions this application can perform through its connected endpoints.</p>
              </div>
              {mcpServers.length === 0 ? (
                <div className="keys-empty">No MCP endpoints are listed for this application.</div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {mcpServers.flatMap((server) => server.tools.map((tool) => ({ server, tool }))).map(({ server, tool }) => (
                    <article key={`${server.url}:${tool.name}`} className="rounded-lg border border-[#edf0ec] p-4">
                      <strong className="text-base font-semibold text-[#354a39]">{formatActionName(tool.name)}</strong>
                      <p className="mb-0 mt-2 text-sm leading-6 text-[#69756c]">{tool.description}</p>
                    </article>
                  ))}
                  {mcpServers.filter((server) => server.error).map((server) => (
                    <p key={server.url} className="mb-0 text-sm text-[#986750]">{server.name}: {server.error}</p>
                  ))}
                  {mcpServers.some((server) => !server.error && server.tools.length === 0) && mcpServers.every((server) => server.tools.length === 0) && (
                    <p className="mb-0 text-sm text-[#818b83]">These endpoints returned no MCP functions.</p>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </section>
  );
}
