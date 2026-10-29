import requests from "./context.json";
import { getPersonalBasics } from "@/services/context/personal.basics";
import { getPersonalNotifications } from "@/services/context/personal.notifications";
import { getPersonalLeads } from "@/services/context/personal.leads";
import { getPersonalListings } from "@/services/context/personal.listings";
import { logServiceRun } from "@/services/service-logger";

type RequestCatalog = Record<string, string[]>;

const catalog = requests as RequestCatalog;
const listedCommands = new Set(Object.values(catalog).flat());
const requestPattern = /^--req(?:\.[a-zA-Z0-9_-]+)*--$/;

export type ContextRequest = string;

/** Recognizes complete context commands so the manager can report unknown ones. */
export function isContextRequest(reply: string): ContextRequest | null {
  const normalized = reply.trim();
  return requestPattern.test(normalized) ? normalized : null;
}

/** Returns the context command payload, or a discovery list for catalog keys. */
export const contextManager = {
  /** Resolves commands declared by context.json and gathers their data. */
  async collect(request: ContextRequest, authAccountToken?: string | null): Promise<Record<string, unknown>> {
    await logServiceRun("context.collect", { request });
    const commands = catalog[request];
    if (commands) {
      const availableCommands = [...new Set(commands)].filter((command) => command !== request);
      return { request, available: true, commands: availableCommands };
    }

    if (!listedCommands.has(request)) {
      return {
        request,
        available: false,
        message: "This command does not exist. Continue without information.",
      };
    }

    if (request === "--req.personal.basics--") {
      return { request, available: true, ...(await getPersonalBasics(authAccountToken)) };
    }

    if (request === "--req.personal.notifications--") {
      return { request, available: true, ...(await getPersonalNotifications(authAccountToken)) };
    }

    if (request === "--req.estate.leads--") {
      return { request, available: true, ...(await getPersonalLeads(authAccountToken)) };
    }

    if (request === "--req.estate.listings--") {
      return { request, available: true, ...(await getPersonalListings(authAccountToken)) };
    }

    return {
      request,
      available: false,
      message: "This command does not exist. Continue without information.",
    };
  },
};
