import requests from "./context.json";

type RequestCatalog = Record<string, string[]>;

const catalog = requests as RequestCatalog;
const knownRequests = new Set(Object.values(catalog).flat());

export type ContextRequest = string;

/** Finds a request command only when the complete assistant reply is a known command. */
export function isContextRequest(reply: string): ContextRequest | null {
  const normalized = reply.trim();
  if (normalized === "--req--") return normalized;
  return knownRequests.has(normalized) ? normalized : null;
}

/** Collects app-owned data for a command. Integrations can be registered here as they are added. */
export const contextManager = {
  async collect(request: ContextRequest): Promise<Record<string, unknown>> {
    const scope = request.slice("--req.".length, -2).split(".");
    const data: Record<string, unknown> = { request, available: false };

    if (request === "--req--") {
      data.availableRequests = catalog.default.filter((command) => command !== "--req--");
      data.instruction = "Choose the most relevant specific request command, then respond with only that command.";
    }

    if (scope[0] === "personal" || request === "--req--") {
      data.profile = { available: false, reason: "No signed-in profile is connected to this workspace." };
      data.settings = { available: false, reason: "Personal settings are not stored in the application yet." };
    }

    if (scope.includes("calendar") || request === "--req.calendar--") {
      data.calendar = { available: false, reason: "No calendar integration is connected." };
    }

    if (scope[0] === "estate" || ["--req.lead--", "--req.tasks--", "--req.notes--", "--req.reminders--"].includes(request)) {
      data.applicationData = { available: false, reason: "This workspace has no connected data source for this request yet." };
    }

    return data;
  },
};
