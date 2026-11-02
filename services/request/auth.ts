import "server-only";
import { headers } from "next/headers";

export { auth } from "@neup/logica/account/auth";

type CookieReader = (name: string) => Promise<string | null | undefined>;

/** Reads the public app credential from the auth cookie before the x-auth header. */
export async function getPublicAccountToken(getCookie: CookieReader, request?: Request) {
  const cookieToken = (await getCookie("auth"))?.trim();
  if (cookieToken) return cookieToken;

  const requestHeaders = request?.headers ?? await headers();
  return requestHeaders.get("x-auth")?.trim() || undefined;
}

/** Reads the account credential from the bridge request header without consulting cookies. */
export function getBridgeEndpointAccountToken(request: Request) {
  return request.headers.get("x-auth")?.trim() || undefined;
}
