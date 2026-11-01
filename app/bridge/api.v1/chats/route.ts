import { NextResponse } from "next/server";
import { getCookie } from "@neup/core/helpers/cookie";
import { logApplicationError } from "@/app/server-logger";
import { ensureAccount } from "@neup/shared/account/self";
import { deleteAllAccountChats, deleteChat, getChat, listChats } from "@/services/chat";

export const runtime = "nodejs";

/** Validates canonical UUID chat identifiers supplied by the client. */
function isChatUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET() {
  try {
    await ensureAccount(await getCookie("auth_account"));
    return NextResponse.json(await listChats());
  }
  catch (error) { await logApplicationError(error, "GET /api/chats"); return NextResponse.json({ error: "Could not load saved chats." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const chatId = body?.chatId;
    if (!isChatUuid(chatId)) return NextResponse.json({ error: "Chat ID must be a UUID." }, { status: 400 });
    const chat = await getChat(chatId);
    return chat ? NextResponse.json(chat) : NextResponse.json({ error: "Saved chat was not found." }, { status: 404 });
  } catch (error) { await logApplicationError(error, "POST /api/chats"); return NextResponse.json({ error: "Could not load saved chat." }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("all") === "true") {
      const account = await ensureAccount(await getCookie("auth_account"));
      if (!account) return NextResponse.json({ error: "Sign in to delete your saved chats." }, { status: 401 });
      const deleted = await deleteAllAccountChats(account.id);
      return NextResponse.json({ deleted });
    }
    const chatId = url.searchParams.get("id");
    if (!isChatUuid(chatId)) return NextResponse.json({ error: "Chat ID must be a UUID." }, { status: 400 });
    const deleted = await deleteChat(chatId);
    return deleted ? NextResponse.json({ id: chatId }) : NextResponse.json({ error: "Saved chat was not found." }, { status: 404 });
  } catch (error) { await logApplicationError(error, "DELETE /api/chats"); return NextResponse.json({ error: "Could not delete saved chat." }, { status: 503 }); }
}
