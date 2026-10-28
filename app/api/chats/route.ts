import { NextResponse } from "next/server";
import { logApplicationError } from "../../server-logger";
import { getChat, listChats } from "../../../services/chat";

export const runtime = "nodejs";

export async function GET() {
  try { return NextResponse.json(await listChats()); }
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
