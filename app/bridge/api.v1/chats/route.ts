import { NextResponse } from "next/server";
import { logApplicationError } from "@/app/server-logger";
import { ensureAccount } from "@neup/shared/account/self";
import { createChat, deleteAllAccountChats, deleteChat, getChat, listChats } from "@/services/chat";
import { getBridgeEndpointAccountToken } from "@/services/request/auth";

export const runtime = "nodejs";

/** Parses a bounded non-negative pagination parameter. */
function getPaginationValue(value: string | null, fallback: number, maximum: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, maximum) : null;
}

/** Validates canonical UUID chat identifiers supplied by the client. */
function isChatUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = getPaginationValue(url.searchParams.get("limit"), 10, 100);
    const offset = getPaginationValue(url.searchParams.get("offset"), 0, 1000000);
    if (limit === null || offset === null) return NextResponse.json({ error: "Limit and offset must be non-negative integers." }, { status: 400 });
    const account = await ensureAccount(await getBridgeEndpointAccountToken(request));
    if (!account) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    return NextResponse.json(await listChats(account?.id, limit, offset));
  }
  catch (error) { await logApplicationError(error, "GET /api/chats"); return NextResponse.json({ error: "Could not load saved chats." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    let body: unknown = {};
    try { body = await request.json(); } catch { /* An empty request creates a default titled chat. */ }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    const input = body as { title?: unknown; chatId?: unknown };
    const account = await ensureAccount(await getBridgeEndpointAccountToken(request));
    if (!account) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

    if (input.chatId !== undefined) {
      if (!isChatUuid(input.chatId)) return NextResponse.json({ error: "Chat ID must be a UUID." }, { status: 400 });
      const chat = await getChat(input.chatId, account.id);
      return chat ? NextResponse.json(chat) : NextResponse.json({ error: "Chat was not found." }, { status: 404 });
    }

    const title = input.title;
    if (title !== undefined && typeof title !== "string") return NextResponse.json({ error: "Title must be a string." }, { status: 400 });
    return NextResponse.json(await createChat(account?.id, title as string | undefined), { status: 201 });
  } catch (error) {
    await logApplicationError(error, "POST /api/chats");
    return NextResponse.json({ error: "Could not create chat." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("all") === "true") {
      const account = await ensureAccount(await getBridgeEndpointAccountToken(request));
      if (!account) return NextResponse.json({ error: "Sign in to delete your saved chats." }, { status: 401 });
      const deleted = await deleteAllAccountChats(account.id);
      return NextResponse.json({ deleted });
    }
    const account = await ensureAccount(await getBridgeEndpointAccountToken(request));
    if (!account) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    const chatId = url.searchParams.get("id");
    if (!isChatUuid(chatId)) return NextResponse.json({ error: "Chat ID must be a UUID." }, { status: 400 });
    const chat = await getChat(chatId, account.id);
    if (!chat) return NextResponse.json({ error: "Saved chat was not found." }, { status: 404 });
    const deleted = await deleteChat(chatId);
    return deleted ? NextResponse.json({ id: chatId }) : NextResponse.json({ error: "Saved chat was not found." }, { status: 404 });
  } catch (error) { await logApplicationError(error, "DELETE /api/chats"); return NextResponse.json({ error: "Could not delete saved chat." }, { status: 503 }); }
}
