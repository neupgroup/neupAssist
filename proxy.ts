import { NextRequest, NextResponse } from "next/server";

/** Sends unauthenticated app requests through NeupID sign-in with their full return URL. */
export function proxy(request: NextRequest) {
  const authCookie = request.cookies.get("auth")?.value?.trim();
  const authHeader = request.headers.get("x-auth")?.trim();
  if (authCookie || authHeader) return NextResponse.next();

  const signInUrl = new URL("https://neupgroup.com/account/auth/start");
  signInUrl.searchParams.set("authenticatesTo", request.nextUrl.href);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
