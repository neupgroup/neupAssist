import "server-only";

/** Builds standard MCP headers and adds x-auth for Neupgroup-owned endpoints. */
export function getMcpRequestHeaders(endpoint: string, accountToken: string, sessionId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };

  try {
    const hostname = new URL(endpoint).hostname.toLowerCase();
    if (hostname === "neupgroup.com" || hostname.endsWith(".neupgroup.com")) {
      headers["x-auth"] = accountToken;
    }
  } catch {
    // Invalid endpoints are rejected by fetch; do not attach credentials to them.
  }

  if (sessionId) headers["MCP-Session-Id"] = sessionId;
  return headers;
}
