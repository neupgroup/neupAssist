import "server-only";
import { runApi } from "@neup/core/infrastructure/api";
import { logica } from "@neup/logica";
import { getBaseUrl } from "@neup/logica/baseurl";
import { logServiceRun } from "@/services/service-logger";
import type { ToolDefinition, ToolExecutionContext } from "./index";

export const estate_getMyListingsDefinition: ToolDefinition = {
  name: "estate_getMyListings",
  description: "Get estate properties listed by the signed-in user.",
  parameters: { type: "object", properties: {}, required: [] },
  format: "```neup.estate.property.saved\n{\"propertyId\":\"propertyId\",\"title\":\"propertyTitle\",\"price\":\"price\",\"location\":\"location\",\"type\":\"propertyType\",\"image\":\"imageUrl\"}\n```",
  guidelines: "Use this format when showing listings: {{format}}. Output one block per property and include only fields present in the data.",
};

type PropertyRecord = Record<string, unknown>;

type PropertyListResponse = {
  success?: boolean;
  properties?: unknown;
  error?: string;
};

export type PersonalListings = {
  available: boolean;
  listings: PropertyRecord[];
  reason?: "missing_auth_account" | "account_unavailable" | "listings_unavailable";
};

/** Loads properties listed by the currently signed-in account. */
export async function estate_getMyListings(context: ToolExecutionContext): Promise<PersonalListings> {
  const { authAccountToken } = context;
  await logServiceRun("context.personal.listings");
  const accountToken = authAccountToken?.trim();
  if (!accountToken) return { available: false, listings: [], reason: "missing_auth_account" };

  try {
    const account = await logica.account.lookup.current.get(accountToken, ["accountId"]);
    const accountId = account.body.accountId;
    if (!account.ok || !account.body.success || !accountId) {
      return { available: false, listings: [], reason: "account_unavailable" };
    }

    const response = await runApi<PropertyListResponse>({
      baseUrl: getBaseUrl("estate"),
      path: `bridge/api.v1/properties/account/${encodeURIComponent(accountId)}/listed`,
      query: { offset: 0, limit: 25 },
      headers: { "x-auth": accountToken },
    });
    if (!response.ok || response.body?.success === false) {
      return { available: false, listings: [], reason: "listings_unavailable" };
    }

    const records = Array.isArray(response.body?.properties) ? response.body.properties : [];
    const listings = records.filter((record): record is PropertyRecord => Boolean(record) && typeof record === "object" && !Array.isArray(record));
    return { available: true, listings };
  } catch {
    return { available: false, listings: [], reason: "listings_unavailable" };
  }
}
