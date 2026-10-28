import { NextResponse } from "next/server";
import { logApplicationError } from "../../server-logger";
import { prisma } from "../../../prisma/client/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      select: { id: true, title: true, lastUpdated: true },
      orderBy: { lastUpdated: "desc" },
      take: 50,
    });
    return NextResponse.json(chats);
  } catch (error) {
    await logApplicationError(error, "GET /api/chats");
    return NextResponse.json({ error: "Could not load saved chats." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const chatId = Number(body?.chatId);
    if (!Number.isInteger(chatId) || chatId < 1) {
      return NextResponse.json({ error: "Chat ID must be a positive integer." }, { status: 400 });
    }
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        id: true,
        title: true,
        messages: { orderBy: { sent_on: "asc" }, select: { type: true, content: true } },
      },
    });
    if (!chat) return NextResponse.json({ error: "Saved chat was not found." }, { status: 404 });
    return NextResponse.json({
      id: chat.id,
      title: chat.title,
      messages: chat.messages.map((message) => ({
        role: message.type === "userSent" ? "user" : "assistant",
        text: message.content,
      })),
    });
  } catch (error) {
    await logApplicationError(error, "POST /api/chats");
    return NextResponse.json({ error: "Could not load saved chat." }, { status: 503 });
  }
}
