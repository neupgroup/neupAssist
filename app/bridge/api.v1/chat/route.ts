import { NextResponse } from "next/server";
import { getCookie } from "@neup/core/helpers/cookie";
import { logApplicationError } from "@/app/server-logger";
import { sendChat, type ChatMessage } from "@/services/chat";
import { getPublicAccountToken } from "@/services/request/auth";

export const runtime = "nodejs";

/** Checks whether a chat identifier is a UUID. */
function isChatUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const input = body && typeof body === "object" ? body as { messages?: unknown; chatId?: unknown; retryPending?: unknown } : {};
  const isPendingRetry = input.retryPending === true;
  if (!isPendingRetry && (!Array.isArray(input.messages) || input.messages.length === 0 || input.messages.length > 100 || input.messages.some((message) => !message || typeof message !== "object" || !["user", "assistant"].includes((message as ChatMessage).role) || typeof (message as ChatMessage).content !== "string"))) return NextResponse.json({ error: "Send a conversation containing user and assistant messages." }, { status: 400 });
  if (input.chatId !== undefined && !isChatUuid(input.chatId)) return NextResponse.json({ error: "Chat ID must be a UUID." }, { status: 400 });
  const encoder = new TextEncoder();
  const authAccountToken = await getPublicAccountToken(getCookie, request);
  const progressQueue: string[] = [];
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const result = await sendChat((input.messages ?? []) as ChatMessage[], input.chatId as string | undefined, (progress) => {
          progressQueue.push(JSON.stringify({ type: "progress", progress }));
          const pending = progressQueue.splice(0);
          for (const event of pending) controller.enqueue(encoder.encode(`${event}\n`));
        }, authAccountToken, (chatId) => emit({ type: "saved", chatId }), isPendingRetry);
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
