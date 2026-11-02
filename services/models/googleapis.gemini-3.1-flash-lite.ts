import type { ChatTurn } from "../request/chat";
import { buildSystemPrompt } from "../request/prompts";
import { logger } from "@neup/logica/logger";
import { logAIRequest, redactLogSecrets } from "../../app/server-logger";

export const modelId = "gemini-3.1-flash-lite";

export const requestFormat = {
  method: "POST",
  endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
  headers: { "Content-Type": "application/json", "x-goog-api-key": "API key from the database" },
  body: {
    systemInstruction: { parts: [{ text: "string" }] },
    contents: [{ role: "user | model", parts: [{ text: "string" }] }],
  },
} as const;

export const responseFormat = {
  candidates: [{ content: { parts: [{ text: "string" }] } }],
  usageMetadata: { totalTokenCount: "number" },
} as const;

export function supportsModel(model: string) {
  return model.toLowerCase() === modelId;
}

export function buildRequest(messages: ChatTurn[], systemInstruction = buildSystemPrompt({ includeTextContext: false })) {
  return {
    url: requestFormat.endpoint,
    headers: { "Content-Type": "application/json" },
    body: {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: messages.map(({ role, content }) => ({
        role: role === "assistant" ? "model" : "user",
        parts: [{ text: content }],
      })),
    },
  };
}

export function readResponse(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const candidates = (result as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") return undefined;
  const content = (candidates[0] as { content?: unknown }).content;
  if (!content || typeof content !== "object") return undefined;
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return undefined;
  const text = parts.flatMap((part) => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? [(part as { text: string }).text] : []).join("");
  return text || undefined;
}

export async function requestGeminiFlashLite({ apiKey, messages }: { apiKey: string; messages: ChatTurn[] }): Promise<{ output: string } | { error: string; status: number }> {
  try {
    const request = buildRequest(messages);
    const headers = new Headers(request.headers);
    headers.set("x-goog-api-key", apiKey);
    const body = JSON.stringify(request.body);
    await logAIRequest({ provider: "google", model: modelId, url: request.url, method: requestFormat.method, headers, body, apiKey });
    const response = await fetch(request.url, {
      method: requestFormat.method,
      headers,
      body,
      signal: AbortSignal.timeout(60_000),
    });
    const responseBody = await response.text();
    try { await logger.type("ai-response").data({ provider: "google", model: modelId, status: response.status, ok: response.ok, response: redactLogSecrets(responseBody, [apiKey]) }).log(); } catch { /* Logging must not interrupt provider response handling. */ }
    let result: unknown;
    try { result = JSON.parse(responseBody); } catch { result = null; }
    if (!response.ok) {
      const payload = result as { error?: { message?: unknown }; message?: unknown } | null;
      const detail = typeof payload?.error?.message === "string" ? payload.error.message : typeof payload?.message === "string" ? payload.message : responseBody.slice(0, 500) || "The provider request failed.";
      return { error: detail, status: response.status >= 400 && response.status < 500 ? 502 : 503 };
    }
    const output = readResponse(result);
    return typeof output === "string" && output.trim() ? { output: output.trim() } : { error: "The provider returned an empty response.", status: 502 };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The Google model request could not be completed.", status: 502 };
  }
}
