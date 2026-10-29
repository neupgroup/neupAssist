import { NextResponse } from "next/server";
import { getCookie } from "@neup/core/helpers/cookie";
import { logApplicationError } from "../../server-logger";
import { ensureAccount } from "../../../services/account";
import { deleteChat, getChat, listChats } from "../../../services/chat";

export const runtime = "nodejs";

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
    const chatId = Number(body?.chatId);
    if (!Number.isInteger(chatId) || chatId < 1) return NextResponse.json({ error: "Chat ID must be a positive integer." }, { status: 400 });
    const chat = await getChat(chatId);
    return chat ? NextResponse.json(chat) : NextResponse.json({ error: "Saved chat was not found." }, { status: 404 });
  } catch (error) { await logApplicationError(error, "POST /api/chats"); return NextResponse.json({ error: "Could not load saved chat." }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  try {
    const chatId = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(chatId) || chatId < 1) return NextResponse.json({ error: "Chat ID must be a positive integer." }, { status: 400 });
    const deleted = await deleteChat(chatId);
    return deleted ? NextResponse.json({ id: chatId }) : NextResponse.json({ error: "Saved chat was not found." }, { status: 404 });
  } catch (error) { await logApplicationError(error, "DELETE /api/chats"); return NextResponse.json({ error: "Could not delete saved chat." }, { status: 503 }); }
}
