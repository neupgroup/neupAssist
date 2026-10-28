import "server-only";
import { getCookie } from "@neup/core/helpers/cookie";
import { logica } from "@neup/logica";

export type PersonalBasics = {
  available: boolean;
  profile: {
    displayName: string | null;
    displayImage: string | null;
    neupid: string | null;
  } | null;
  reason?: "missing_auth_account" | "profile_unavailable";
};

/** Loads basic identity details for the signed-in account through Logica. */
export async function getPersonalBasics(): Promise<PersonalBasics> {
  const authAccountToken = (await getCookie("auth_account"))?.trim();
  if (!authAccountToken) {
    return { available: false, profile: null, reason: "missing_auth_account" };
  }

  try {
    const profiles = await logica.account.self.getBasics(authAccountToken);
    const profile = profiles[0];
    if (!profile) return { available: false, profile: null, reason: "profile_unavailable" };

    return {
      available: true,
      profile: {
        displayName: profile.displayName,
        displayImage: profile.displayImage,
        neupid: profile.neupid,
      },
    };
  } catch {
    return { available: false, profile: null, reason: "profile_unavailable" };
  }
}
