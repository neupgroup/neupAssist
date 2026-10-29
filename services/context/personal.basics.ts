import "server-only";
import { logica } from "@neup/logica";
import { logger } from "@neup/logica/logger";
import { logServiceRun } from "@/services/service-logger";

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
export async function getPersonalBasics(authAccountToken?: string | null): Promise<PersonalBasics> {
  await logServiceRun("context.personal.basics");
  const accountToken = authAccountToken?.trim();
  if (!accountToken) {
    const result = { available: false, profile: null, reason: "missing_auth_account" } as const;
    await logPersonalBasics(result);
    return result;
  }

  try {
    const profiles = await logica.account.self.getBasics(accountToken);
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
