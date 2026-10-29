import "server-only";
import { runApi } from "@neup/core/infrastructure/api";
import { logica } from "@neup/logica";
import { getBaseUrl } from "@neup/logica/baseurl";
import { logServiceRun } from "@/services/service-logger";

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
export async function getPersonalSavedProperties(authAccountToken?: string | null): Promise<PersonalSavedProperties> {
  await logServiceRun("context.personal.saved-properties");
  const accountToken = authAccountToken?.trim();
  if (!accountToken) return { available: false, properties: [], reason: "missing_auth_account" };

  try {
    const response = await runApi<SavedPropertiesResponse>({
      baseUrl: getBaseUrl("estate"),
      path: "bridge/api.v1/properties/saved",
      query: { account: "me", offset: 0, limit: 25 },
      cookies: { auth_account: accountToken },
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
    const properties = await Promise.all(savedProperties.map(enrichSavedProperty));
    return { available: true, properties };
  } catch {
    return { available: false, properties: [], reason: "saved_properties_unavailable" };
  }
}

/** Loads property details for a saved reference that contains only its property ID. */
async function enrichSavedProperty(savedProperty: SavedPropertyRecord): Promise<SavedPropertyRecord> {
  const propertyId = typeof savedProperty.propertyId === "string"
    ? savedProperty.propertyId
    : typeof savedProperty.id === "string"
      ? savedProperty.id
      : null;
  if (!propertyId || savedProperty.property || savedProperty.title || savedProperty.name) return savedProperty;

  try {
    const response = await logica.estate.property(propertyId).get();
    const property = response.ok && response.body.success ? response.body.property : null;
    return property
      ? { ...savedProperty, ...property, propertyId, savedAt: savedProperty.savedAt ?? savedProperty.createdAt }
      : savedProperty;
  } catch {
    return savedProperty;
  }
}
