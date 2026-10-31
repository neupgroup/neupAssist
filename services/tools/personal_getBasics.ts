import "server-only";
import { runApi } from "@neup/core/infrastructure/api";
import { logica } from "@neup/logica";
import { getBaseUrl } from "@neup/logica/baseurl";
import { logger } from "@neup/logica/logger";
import { logServiceRun } from "@/services/service-logger";
import type { ToolDefinition, ToolExecutionContext } from "./index";

export const personal_getBasicsDefinition: ToolDefinition = {
  name: "personal_getBasics",
  description: "Get the signed-in user's basic profile details.",
  parameters: { type: "object", properties: {}, required: [] },
  format: "```nia.personal.basics\n{\"displayName\":\"{{displayName}}\",\"displayImage\":\"{{displayImage}}\",\"neupid\":\"{{neupid}}\"}\n```",
  guidelines: "Use this format when showing the user's profile: {{format}}. Omit fields that are null.",
};

export type PersonalBasics = {
  available: boolean;
  profile: {
    displayName: string | null;
    displayImage: string | null;
    neupid: string | null;
  } | null;
  reason?: "missing_auth_account" | "profile_unavailable";
};


/** Logs the returned personal basics payload without including authentication data. */
async function logPersonalBasics(result: PersonalBasics) {
  try {
    await logger.type("context-personal-basics").data(result).log();
  } catch {
    // Logging must not interrupt context collection.
  }
}

/** Loads basic identity details for the signed-in account through Logica. */
export async function personal_getBasics(context: ToolExecutionContext): Promise<PersonalBasics> {
  const { authAccountToken } = context;
  await logServiceRun("context.personal.basics");
  const accountToken = authAccountToken?.trim();
  if (!accountToken) {
    const result = { available: false, profile: null, reason: "missing_auth_account" } as const;
    await logPersonalBasics(result);
    return result;
  }

  try {
    const response = await runApi<{
      success?: boolean;
      displayName?: string | null;
      displayImage?: string | null;
      neupid?: string | null;
    }>({
      baseUrl: getBaseUrl("neupid"),
      path: "bridge/api.v1/account/basics",
      method: "GET",
      headers: { "x-auth": accountToken },
    });
    const profiles = response.ok && response.body?.success
      ? [{
          displayName: response.body.displayName ?? null,
          displayImage: response.body.displayImage ?? null,
          neupid: response.body.neupid ?? null,
        }]
      : [];
    const profile = profiles[0];
    if (!profile) {
      const result = { available: false, profile: null, reason: "profile_unavailable" } as const;
      await logPersonalBasics(result);
      return result;
    }

    const result: PersonalBasics = {
      available: true,
      profile: {
        displayName: profile.displayName,
        displayImage: profile.displayImage,
        neupid: profile.neupid,
      },
    };
    await logPersonalBasics(result);
    return result;
  } catch {
    const result = { available: false, profile: null, reason: "profile_unavailable" } as const;
    await logPersonalBasics(result);
    return result;
  }
}
