import { NextResponse } from "next/server";
import { ensureAccount } from "@neup/shared/account/self";
import { listConnectedChatApps } from "@/services/chat";
import { logApplicationError } from "@/app/server-logger";
import { getBridgeEndpointAccountToken } from "@/services/request/auth";

export const runtime = "nodejs";

/** Returns active apps available for chat mentions. */
export async function GET(request: Request) {
  try {
    const account = await ensureAccount(await getBridgeEndpointAccountToken(request));
    return NextResponse.json(await listConnectedChatApps(account?.id));
  } catch (error) {
    await logApplicationError(error, "GET /api/applications");
    return NextResponse.json({ error: "Could not load connected apps." }, { status: 503 });
  }
}
