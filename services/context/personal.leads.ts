import "server-only";
import { createApiUrl, runApi, type ApiMethod } from "@neup/core/infrastructure/api";
import { logger } from "@neup/logica/logger";
import { getBaseUrl } from "@neup/logica/baseurl";
import endpointConfig from "@neup/logica/estate/endpoints.json";
import { logServiceRun } from "@/services/service-logger";

type LeadRecord = Record<string, unknown>;

type LeadListResponse = {
  success?: boolean;
  data?: unknown;
  leads?: unknown;
  error?: string;
  error_description?: string;
};

const leadsEndpoint = (endpointConfig as Record<string, { path: string; method: ApiMethod }>)['leads:shared'];

export type PersonalLeads = {
  available: boolean;
  leads: LeadRecord[];
  reason?: "missing_auth_account" | "leads_unavailable";
};

/** Logs lead lookup results without including the account authentication token. */
async function logPersonalLeads(data: Record<string, unknown>) {
  try {
    await logger.type("context-personal-leads").data(data).log();
  } catch {
    // Logging must not interrupt context collection.
  }
}

/** Loads leads visible to the signed-in account through the Logica estate API. */
export async function getPersonalLeads(authAccountToken?: string | null): Promise<PersonalLeads> {
  await logServiceRun("context.personal.leads");
  const accountToken = authAccountToken?.trim();
  if (!accountToken) {
    await logPersonalLeads({ outcome: "missing_auth_account", authAccountTokenReceived: false });
    return { available: false, leads: [], reason: "missing_auth_account" };
  }

  try {
    const query = { limit: 25, offset: 0 };
    const fullPath = createApiUrl(getBaseUrl("estate"), leadsEndpoint.path, query);
    const response = await runApi<LeadListResponse>({
      baseUrl: getBaseUrl("estate"),
      path: leadsEndpoint.path,
      method: leadsEndpoint.method,
      query,
      headers: { "x-auth": accountToken },
    });
    if (!response.ok || response.body?.success === false) {
      await logPersonalLeads({
        outcome: "leads_lookup_failed",
        method: leadsEndpoint.method,
        path: fullPath,
        status: response.status,
        allow: response.headers.get("allow"),
        success: response.body?.success,
        error: response.body?.error,
        errorDescription: response.body?.error_description,
      });
      return { available: false, leads: [], reason: "leads_unavailable" };
    }

    const records = Array.isArray(response.body?.data)
      ? response.body.data
      : Array.isArray(response.body?.leads)
        ? response.body.leads
        : [];
    const leads = records.filter((record): record is LeadRecord => Boolean(record) && typeof record === "object" && !Array.isArray(record));
    await logPersonalLeads({ outcome: "success", status: response.status, count: leads.length, leads });
    return { available: true, leads };
  } catch {
    await logPersonalLeads({ outcome: "request_exception" });
    return { available: false, leads: [], reason: "leads_unavailable" };
  }
}
