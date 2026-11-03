import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureAccount } from "@neup/shared/account/self";
import { prisma } from "@neup/core/database/prisma";
import { logApplicationError } from "@/app/server-logger";
import { getBridgeEndpointAccountToken } from "@/services/request/auth";

export const runtime = "nodejs";

/** Validates an API key record identifier. */
function isApiKeyId(value: string | null): value is string {
  return value !== null && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Creates a one-time visible API credential with a recognizable prefix. */
function createApiToken(): string {
  return `nia_${randomBytes(32).toString("hex")}`;
}

/** Lists API key metadata owned by the authenticated account. */
export async function GET(request: Request) {
  try {
    const account = await ensureAccount(await getBridgeEndpointAccountToken(request));
    if (!account) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    const keys = await prisma.callerKey.findMany({
      where: { account_id: account.id },
      select: { id: true, key: true, added_on: true, expired_on: true },
      orderBy: { added_on: "desc" },
    });
    return NextResponse.json(keys.map(({ key, ...entry }) => ({
      ...entry,
      keyPreview: `${key.slice(0, 8)}••••${key.slice(-4)}`,
    })));
  } catch (error) {
    await logApplicationError(error, "GET /bridge/api.v1/manage/api-keys");
    return NextResponse.json({ error: "Could not load API keys." }, { status: 503 });
  }
}

/** Creates an API key for the authenticated account. */
export async function POST(request: Request) {
  const account = await ensureAccount(await getBridgeEndpointAccountToken(request));
  if (!account) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const expiresInDays = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>).expiresInDays
    : undefined;
  if (expiresInDays !== 30 && expiresInDays !== 90 && expiresInDays !== 365) {
    return NextResponse.json({ error: "Choose an expiration of 30, 90, or 365 days." }, { status: 400 });
  }

  const token = createApiToken();
  const expiredOn = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  try {
    const apiKey = await prisma.callerKey.create({
      data: { account_id: account.id, key: token, expired_on: expiredOn },
      select: { id: true, added_on: true, expired_on: true },
    });
    return NextResponse.json({ ...apiKey, key: token }, { status: 201 });
  } catch (error) {
    await logApplicationError(error, "POST /bridge/api.v1/manage/api-keys");
    return NextResponse.json({ error: "Could not create an API key." }, { status: 503 });
  }
}

/** Revokes one API key owned by the authenticated account. */
export async function DELETE(request: Request) {
  const account = await ensureAccount(await getBridgeEndpointAccountToken(request));
  if (!account) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!isApiKeyId(id)) return NextResponse.json({ error: "A valid API key ID is required." }, { status: 400 });

  try {
    const result = await prisma.callerKey.deleteMany({ where: { id, account_id: account.id } });
    if (!result.count) return NextResponse.json({ error: "API key was not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    await logApplicationError(error, "DELETE /bridge/api.v1/manage/api-keys");
    return NextResponse.json({ error: "Could not revoke this API key." }, { status: 503 });
  }
}
