import { NextResponse } from "next/server";
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
  const encoder = new TextEncoder();
  const progressQueue: string[] = [];
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const result = await sendChat(input.messages as ChatMessage[], input.chatId as number | undefined, (contextRequest) => {
          progressQueue.push(JSON.stringify({ type: "request", request: contextRequest }));
          const pending = progressQueue.splice(0);
          for (const event of pending) controller.enqueue(encoder.encode(`${event}\n`));
        });
        if ("error" in result) emit({ type: "error", error: result.error, status: result.status, setupRequired: "setupRequired" in result });
        else emit({ type: "final", result });
      } catch (error) {
        await logApplicationError(error, "POST /api/chat");
        emit({ type: "error", error: "Could not reach the configured AI provider. Check your saved key and try again.", status: 503 });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
