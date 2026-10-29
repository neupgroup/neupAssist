import "server-only";
import { runApi } from "@neup/core/infrastructure/api";
import { logica } from "@neup/logica";
import { getBaseUrl } from "@neup/logica/baseurl";
import { logServiceRun } from "@/services/service-logger";
import type { ToolDefinition, ToolExecutionContext } from "./index";

export const estate_getFavouritesDefinition: ToolDefinition = {
  name: "estate_getFavourites",
  description: "Get properties saved by the signed-in user.",
  parameters: { type: "object", properties: {}, required: [] },
  format: "```neup.estate.property.saved\n{\"propertyId\":\"propertyId\",\"title\":\"propertyTitle\",\"price\":\"price\",\"location\":\"location\",\"type\":\"propertyType\",\"image\":\"imageUrl\"}\n```",
  guidelines: "Use this format when showing saved properties: {{format}}. Output one block per property and include only fields present in the data.",
};

type SavedPropertyRecord = Record<string, unknown>;

type SavedPropertiesResponse = {
  success?: boolean;
  data?: unknown;
  properties?: unknown;
  error?: string;
};

export type PersonalSavedProperties = {
  available: boolean;
  properties: SavedPropertyRecord[];
  reason?: "missing_auth_account" | "saved_properties_unavailable";
};

/** Loads the signed-in account's saved estate properties. */
export async function estate_getFavourites(context: ToolExecutionContext): Promise<PersonalSavedProperties> {
  const { authAccountToken } = context;
  await logServiceRun("context.personal.saved-properties");
  const accountToken = authAccountToken?.trim();
  if (!accountToken) return { available: false, properties: [], reason: "missing_auth_account" };

  try {
    const response = await runApi<SavedPropertiesResponse>({
      baseUrl: getBaseUrl("estate"),
      path: "bridge/api.v1/properties/saved",
      query: { account: "me", offset: 0, limit: 25 },
      headers: { "x-auth": accountToken },
    });
    if (!response.ok || response.body?.success === false) {
      return { available: false, properties: [], reason: "saved_properties_unavailable" };
    }

    const records = Array.isArray(response.body?.data)
      ? response.body.data
      : Array.isArray(response.body?.properties)
        ? response.body.properties
        : [];
    const savedProperties = records.filter((record): record is SavedPropertyRecord => Boolean(record) && typeof record === "object" && !Array.isArray(record));
    const properties = await Promise.all(savedProperties.map((property) => enrichSavedProperty(property, accountToken)));
    return { available: true, properties };
  } catch {
    return { available: false, properties: [], reason: "saved_properties_unavailable" };
  }
}

/** Loads property details for a saved reference that contains only its property ID. */
async function enrichSavedProperty(savedProperty: SavedPropertyRecord, authAccountToken: string): Promise<SavedPropertyRecord> {
  const propertyId = typeof savedProperty.propertyId === "string"
    ? savedProperty.propertyId
    : typeof savedProperty.id === "string"
      ? savedProperty.id
      : null;
  if (!propertyId || savedProperty.property || savedProperty.title || savedProperty.name) return savedProperty;

  try {
    const response = await runApi<{ success?: boolean; property?: Record<string, unknown> }>({
      baseUrl: getBaseUrl("estate"),
      path: `bridge/api.v1/properties/${encodeURIComponent(propertyId)}`,
      method: "GET",
      headers: { "x-auth": authAccountToken },
    });
    const property = response.ok && response.body?.success ? response.body.property : null;
    return property
      ? { ...savedProperty, ...property, propertyId, savedAt: savedProperty.savedAt ?? savedProperty.createdAt }
      : savedProperty;
  } catch {
    return savedProperty;
  }
}
