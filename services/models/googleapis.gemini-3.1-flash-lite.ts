import type { ChatTurn } from "../request/chat";
import instructions from "../request/instructions.json";

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

export function buildRequest(messages: ChatTurn[], systemInstruction = instructions.default) {
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
