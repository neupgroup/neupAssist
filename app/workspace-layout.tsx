import { WorkspaceShell } from "./workspace-shell";
import { getCookie } from "@neup/core/helpers/cookie";
import { ensureAccount } from "@neup/shared/account/self";
import { getPublicAccountToken } from "@/services/request/auth";

/** Loads the signed-in account profile for the shared workspace navigation. */
export async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const account = await ensureAccount(await getPublicAccountToken(getCookie));
  const profile = account
    ? { displayName: account.displayName, displayImage: account.displayImage, neupid: account.neupId ?? "" }
    : null;

  return <WorkspaceShell profile={profile}>{children}</WorkspaceShell>;
}
