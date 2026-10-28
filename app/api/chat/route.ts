import { NextResponse } from "next/server";
import { logger } from "@neup/logica/logger";
import { logApplicationError } from "../../server-logger";
import { prisma } from "../../../prisma/client/server";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const messages = body && typeof body === "object" ? (body as { messages?: unknown }).messages : null;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100 || messages.some((message) => !message || typeof message !== "object" || !["user", "assistant"].includes((message as ChatMessage).role) || typeof (message as ChatMessage).content !== "string")) {
    return NextResponse.json({ error: "Send a conversation containing user and assistant messages." }, { status: 400 });
  }

  try {
    const credentials = await prisma.intelligenceKey.findMany({
      orderBy: { addedOn: "desc" },
      select: { provider: true, model: true, key: true },
    });
    const models = await prisma.intelligenceModel.findMany({
      where: { status: { equals: "active", mode: "insensitive" } },
      orderBy: [{ order_index: "asc" }, { added_on: "asc" }],
      include: { provider: { select: { name: true, code: true, status: true } } },
    });
    const prioritized = models.flatMap((entry) => {
      if (entry.provider.status.toLowerCase() !== "active") return [];
      const credential = credentials.find((key) => key.provider.toLowerCase() === entry.provider.name.toLowerCase() || key.provider.toLowerCase() === entry.provider.code.toLowerCase());
      return credential ? [{ credential, model: entry.model_name, provider: entry.provider }] : [];
    })[0];
    const explicit = credentials.find((entry) => entry.model && entry.provider.toLowerCase() === "openai")
      ?? credentials.find((entry) => Boolean(entry.model));
    const credential = prioritized?.credential ?? explicit;
    const model = prioritized?.model ?? explicit?.model;

    if (!credential) {
      return NextResponse.json({ error: "Add an AI provider key in Manage keys to enable chat.", setupRequired: true }, { status: 409 });
    }

    const provider = prioritized?.provider.code.toLowerCase() ?? credential.provider.toLowerCase();

    if (!model) {
      return NextResponse.json({ error: "No active model with a configured provider key is available. Add a model and provider key in Manage.", setupRequired: true }, { status: 409 });
    }

    const endpoint = provider === "anthropic"
      ? "https://api.anthropic.com/v1/messages"
      : provider === "google"
        ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(credential.key)}`
        : provider === "mistral"
          ? "https://api.mistral.ai/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions";

    const normalizedMessages = messages as ChatMessage[];
    const providerRequest = provider === "anthropic"
      ? {
          model,
          max_tokens: 2048,
          system: "You are Nia, a thoughtful and helpful personal assistant. Be clear, warm, and accurate.",
          messages: normalizedMessages,
        }
      : provider === "google"
        ? {
            systemInstruction: { parts: [{ text: "You are Nia, a thoughtful and helpful personal assistant. Be clear, warm, and accurate." }] },
            contents: normalizedMessages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
          }
        : {
            model,
            messages: [{ role: "system", content: "You are Nia, a thoughtful and helpful personal assistant. Be clear, warm, and accurate." }, ...normalizedMessages],
          };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (provider === "anthropic") {
      headers["x-api-key"] = credential.key;
      headers["anthropic-version"] = "2023-06-01";
    } else if (provider !== "google") {
      headers.Authorization = `Bearer ${credential.key}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(providerRequest),
      signal: AbortSignal.timeout(60_000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof result?.error?.message === "string" ? result.error.message : typeof result?.message === "string" ? result.message : "The provider request failed.";
      await logApplicationError(
        new Error(`Provider returned HTTP ${response.status}: ${detail}`),
        `POST /api/chat · ${credential.provider} · ${model}`,
      );
      return NextResponse.json({ error: detail }, { status: response.status >= 400 && response.status < 500 ? 502 : 503 });
    }

    const text = provider === "anthropic"
      ? result?.content?.find((part: { type?: string }) => part.type === "text")?.text
      : provider === "google"
        ? result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("")
        : result?.choices?.[0]?.message?.content;

    if (typeof text !== "string" || !text.trim()) {
      await logApplicationError(
        new Error("Provider returned an empty response."),
        `POST /api/chat · ${credential.provider} · ${model}`,
      );
      return NextResponse.json({ error: "The provider returned an empty response." }, { status: 502 });
    }
    if (/high demand|rate.?limit|temporarily unavailable|overloaded|at capacity|service unavailable|try again later|internal server error/i.test(text)) {
      await logApplicationError(
        new Error(`Provider returned an error response: ${text.slice(0, 500)}`),
        `POST /api/chat · ${credential.provider} · ${model}`,
      );
    }
    try {
      await logger.type("ai-response").data({
        provider: credential.provider,
        model,
        response: text,
      }).log();
    } catch {
      // Logging failures must not affect the model response.
    }
    return NextResponse.json({ reply: text.trim(), provider: credential.provider, model });
  } catch (error) {
    await logApplicationError(error, "POST /api/chat");
    return NextResponse.json({ error: "Could not reach the configured AI provider. Check your saved key and try again." }, { status: 503 });
  }
}
