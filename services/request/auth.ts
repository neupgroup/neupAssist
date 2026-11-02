import "server-only";
import { cookies, headers } from "next/headers";

export { auth } from "@neup/logica/account/auth";

type CookieReader = (name: string) => Promise<string | null | undefined>;

/** Reads the public app credential from the auth cookie before the x-auth header. */
export async function getPublicAccountToken(getCookie: CookieReader, request?: Request) {
  const cookieToken = (await getCookie("auth"))?.trim();
  if (cookieToken) return cookieToken;

  const requestHeaders = request?.headers ?? await headers();
  return requestHeaders.get("x-auth")?.trim() || undefined;
}

/** Reads the account credential from x-auth, falling back to the auth cookie. */
export async function getBridgeEndpointAccountToken(request: Request) {
  const headerToken = request.headers.get("x-auth")?.trim();
  if (headerToken) return headerToken;

  const cookieToken = request.headers.get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("auth="))
    ?.slice("auth=".length);
  if (cookieToken?.trim()) {
    try {
      return decodeURIComponent(cookieToken).trim();
    } catch {
      return cookieToken.trim();
    }
  }

  return (await cookies()).get("auth")?.value?.trim() || undefined;
}
