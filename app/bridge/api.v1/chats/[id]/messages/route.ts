import { NextResponse } from "next/server";
import { getCookie } from "@neup/core/helpers/cookie";
import { ensureAccount } from "@neup/shared/account/self";
import { logApplicationError } from "@/app/server-logger";
import { listChatMessages, sendChat } from "@/services/chat";
import { getPublicAccountToken } from "@/services/request/auth";

export const runtime = "nodejs";

/** Checks whether a chat identifier is a UUID. */
function isChatUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Parses a bounded non-negative pagination parameter. */
function getPaginationValue(value: string | null, fallback: number, maximum: number) {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, maximum) : null;
}

/** Returns a page of messages from the requested conversation. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isChatUuid(id)) return NextResponse.json({ error: "Chat ID must be a UUID." }, { status: 400 });
    const url = new URL(request.url);
    const limit = getPaginationValue(url.searchParams.get("limit"), 20, 100);
    const offset = getPaginationValue(url.searchParams.get("offset"), 0, 1000000);
    if (limit === null || offset === null) return NextResponse.json({ error: "Limit and offset must be non-negative integers." }, { status: 400 });
    const authToken = await getPublicAccountToken(getCookie, request);
    const account = await ensureAccount(authToken);
    const result = await listChatMessages(id, account?.id, limit, offset);
    return result ? NextResponse.json(result) : NextResponse.json({ error: "Chat was not found." }, { status: 404 });
  } catch (error) {
    await logApplicationError(error, "GET /api/chats/[id]/messages");
    return NextResponse.json({ error: "Could not load chat messages." }, { status: 503 });
  }
}

/** Sends a user message through the configured assistant providers. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const content = body && typeof body === "object" && !Array.isArray(body) ? (body as { content?: unknown; message?: unknown }).content ?? (body as { message?: unknown }).message : undefined;
  if (typeof content !== "string" || !content.trim()) return NextResponse.json({ error: "Message content is required." }, { status: 400 });
  if (content.length > 100000) return NextResponse.json({ error: "Message content is too long." }, { status: 400 });

  try {
    const { id } = await params;
    if (!isChatUuid(id)) return NextResponse.json({ error: "Chat ID must be a UUID." }, { status: 400 });
    const authToken = await getPublicAccountToken(getCookie, request);
    const account = await ensureAccount(authToken);
    const ownedChat = await listChatMessages(id, account?.id, 1, 0);
    if (!ownedChat) return NextResponse.json({ error: "Chat was not found." }, { status: 404 });

    let savedChatId: string | undefined;
    const result = await sendChat([{ role: "user", content: content.trim() }], id, undefined, authToken, (chatId) => { savedChatId = chatId; });
    if ("error" in result) return NextResponse.json({ error: result.error, ...( "setupRequired" in result ? { setupRequired: result.setupRequired } : {}) }, { status: result.status });
    const latestMessages = await listChatMessages(id, account?.id, 2, Math.max(0, ownedChat.pagination.total));
    return NextResponse.json({ id: savedChatId ?? id, result: result.reply, messages: latestMessages?.messages ?? [] });
  } catch (error) {
    await logApplicationError(error, "POST /api/chats/[id]/messages");
    return NextResponse.json({ error: "Could not send chat message." }, { status: 503 });
  }
}
