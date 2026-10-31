import "server-only";
import { logica } from "@neup/logica";
import type { SearchEstatePropertiesInput } from "@neup/logica/estate/property";
import { logServiceRun } from "@/services/service-logger";
import type { ToolDefinition, ToolExecutionContext } from "./index";

export const estate_searchPropertiesDefinition: ToolDefinition = {
  name: "estate_searchProperties",
  description: "Search available estate listings. Use the location argument for city or area searches, including location-only requests such as finding properties in Kathmandu. Other optional filters include keywords, purpose, price, property type, bedrooms, or bathrooms.",
  parameters: {
    type: "object",
    properties: {
      search: { type: "string", description: "Keywords to search in available properties." },
      location: { type: "string", description: "Area, city, or address to search in." },
      purpose: { type: "array", items: { type: "string" }, description: "Listing purpose, such as sale or rent." },
      category: { type: "array", items: { type: "string" }, description: "Property category filters." },
      type: { type: "array", items: { type: "string" }, description: "Property type filters, such as apartment or house." },
      minPrice: { type: "number", description: "Minimum property price." },
      maxPrice: { type: "number", description: "Maximum property price." },
      bedrooms: { type: "number", description: "Exact bedroom count." },
      minBedrooms: { type: "number", description: "Minimum bedroom count." },
      maxBedrooms: { type: "number", description: "Maximum bedroom count." },
      bathrooms: { type: "number", description: "Exact bathroom count." },
      minBathrooms: { type: "number", description: "Minimum bathroom count." },
      maxBathrooms: { type: "number", description: "Maximum bathroom count." },
      tags: { type: "array", items: { type: "string" }, description: "Property tags to match." },
      orderBy: { type: "string", enum: ["newestFirst", "oldestFirst"], description: "Result sort order." },
    },
    required: [],
  },
  format: "```neup.estate.property.saved\n{\"propertyId\":\"propertyId\",\"title\":\"propertyTitle\",\"price\":\"price\",\"location\":\"location\",\"type\":\"propertyType\",\"image\":\"imageUrl\"}\n```",
  guidelines: "Use this format when showing search results: {{format}}. Output one block per property, include only fields present in the data, and briefly state when no properties match.",
};

type PropertyRecord = Record<string, unknown>;

export type EstatePropertySearchResult = {
  available: boolean;
  properties: PropertyRecord[];
  totalCount?: number;
  page?: number;
  totalPages?: number;
  reason?: "search_unavailable";
};

/** Keeps only supported scalar and list values from model supplied search arguments. */
function getSearchFilters(argumentsValue: Record<string, unknown> = {}): SearchEstatePropertiesInput {
  const filters: SearchEstatePropertiesInput = { limit: 10, page: 1 };
  const stringFields = ["search", "location"] as const;
  const numberFields = ["minPrice", "maxPrice", "bedrooms", "minBedrooms", "maxBedrooms", "bathrooms", "minBathrooms", "maxBathrooms"] as const;
  const listFields = ["purpose", "category", "type", "tags"] as const;

  for (const field of stringFields) {
    const value = argumentsValue[field];
    if (typeof value === "string" && value.trim()) filters[field] = value.trim();
  }
  for (const field of numberFields) {
    const value = argumentsValue[field];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) filters[field] = value;
  }
  for (const field of listFields) {
    const value = argumentsValue[field];
    if (typeof value === "string" || Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
      const values = Array.isArray(value) ? value : [value];
      const cleaned = values.map((entry) => entry.trim()).filter(Boolean);
      if (cleaned.length) filters[field] = cleaned;
    }
  }
  if (argumentsValue.orderBy === "newestFirst" || argumentsValue.orderBy === "oldestFirst") filters.orderBy = argumentsValue.orderBy;
  return filters;
}

/** Searches the public estate listings using the Logica property search API. */
export async function estate_searchProperties(context: ToolExecutionContext): Promise<EstatePropertySearchResult> {
  await logServiceRun("context.estate.search-properties");
  try {
    const response = await logica.estate.property.search(getSearchFilters(context.arguments));
    if (!response.ok || response.body?.success === false) return { available: false, properties: [], reason: "search_unavailable" };
    const properties = Array.isArray(response.body?.properties)
      ? response.body.properties.filter((property): property is PropertyRecord => Boolean(property) && typeof property === "object" && !Array.isArray(property))
      : [];
    return {
      available: true,
      properties,
      totalCount: response.body?.totalCount,
      page: response.body?.page,
      totalPages: response.body?.totalPages,
    };
  } catch {
    return { available: false, properties: [], reason: "search_unavailable" };
  }
}
