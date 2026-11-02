import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/services/request/auth";

/** Sends unauthenticated and temporary accounts through NeupID with the full return URL. */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/bridge" || request.nextUrl.pathname.startsWith("/bridge/")) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("auth")?.value?.trim();
  const authHeader = request.headers.get("x-auth")?.trim();
  const token = authCookie || authHeader;
  const verification = token ? await auth.verify(token) : null;
  const payload = verification?.valid ? verification.payload : null;
  const isTemporary = payload?.guest === true || (typeof payload?.guest === "number" && payload.guest !== 0);
  if (payload && !isTemporary) return NextResponse.next();

  const signInUrl = new URL("https://neupgroup.com/account/auth/start");
  signInUrl.searchParams.set("authenticatesTo", request.nextUrl.href);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
