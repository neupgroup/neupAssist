import { NextResponse } from "next/server";
import { getCookie } from "@neup/core/helpers/cookie";
import { ensureAccount } from "@neup/shared/account/self";
import { listConnectedChatApps } from "@/services/chat";
import { logApplicationError } from "@/app/server-logger";
import { getPublicAccountToken } from "@/services/request/auth";

export const runtime = "nodejs";

/** Returns active apps available for chat mentions. */
export async function GET(request: Request) {
  try {
    const account = await ensureAccount(await getPublicAccountToken(getCookie, request));
    return NextResponse.json(await listConnectedChatApps(account?.id));
  } catch (error) {
    await logApplicationError(error, "GET /api/chat/apps");
    return NextResponse.json({ error: "Could not load connected apps." }, { status: 503 });
  }
}
