import { NextResponse } from "next/server";
import { logger } from "@neup/logica/logger";
import { logApplicationError } from "../../server-logger";
import { sendChat, type ChatMessage } from "../../../services/chat";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const input = body && typeof body === "object" ? body as { messages?: unknown; chatId?: unknown } : {};
  if (!Array.isArray(input.messages) || input.messages.length === 0 || input.messages.length > 100 || input.messages.some((message) => !message || typeof message !== "object" || !["user", "assistant"].includes((message as ChatMessage).role) || typeof (message as ChatMessage).content !== "string")) return NextResponse.json({ error: "Send a conversation containing user and assistant messages." }, { status: 400 });
  if (input.chatId !== undefined && (!Number.isInteger(input.chatId) || (input.chatId as number) < 1)) return NextResponse.json({ error: "Chat ID must be a positive integer." }, { status: 400 });
  try {
    const result = await sendChat(input.messages as ChatMessage[], input.chatId as number | undefined);
    if ("error" in result) {
      if ("key" in result) await logApplicationError(new Error(result.error), `POST /api/chat · ${result.provider} · ${result.model}`, result.key ? [result.key] : []);
      return NextResponse.json({ error: result.error, ...( "setupRequired" in result ? { setupRequired: true } : {}) }, { status: result.status });
    }
    try { await logger.type("ai-response").data({ provider: result.provider, model: result.model, response: result.reply }).log(); } catch { /* Logging does not affect the response. */ }
    return NextResponse.json(result);
  } catch (error) {
    await logApplicationError(error, "POST /api/chat");
    return NextResponse.json({ error: "Could not reach the configured AI provider. Check your saved key and try again." }, { status: 503 });
  }
}
