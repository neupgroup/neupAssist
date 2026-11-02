import { WorkspaceShell } from "./workspace-shell";
import { getCookie } from "@neup/core/helpers/cookie";
import { ensureAccount } from "@neup/shared/account/self";
import { getPublicAccountToken } from "@/services/request/auth";

/** Renders the shared workspace navigation around a page. */
export async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const account = await ensureAccount(await getPublicAccountToken(getCookie));
  const profile = account ? { name: account.displayName, image: account.displayImage, username: account.neupId } : null;
  return <WorkspaceShell profile={profile}>{children}</WorkspaceShell>;
}
