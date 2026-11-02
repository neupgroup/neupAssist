import { ClientLayout } from "./layout.client";
import { getCookie } from "@neup/core/helpers/cookie";
import { ensureAccount } from "@neup/shared/account/self";
import { getPublicAccountToken } from "@/services/request/auth";

/** Renders the shared workspace navigation around a page. */
export async function ServerLayout({ children }: { children: React.ReactNode }) {
  const account = await ensureAccount(await getPublicAccountToken(getCookie));
  const profile = account ? { name: account.displayName, image: account.displayImage, username: account.neupId } : null;
  return <ClientLayout profile={profile}>{children}</ClientLayout>;
}
