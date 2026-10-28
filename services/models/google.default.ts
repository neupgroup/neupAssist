import type { ChatMessage } from "../chat";
import instructions from "../request/instructions.json";
import { compileChat, compileChatPrompt } from "../request/chat";
import { extractOutputByFormat, renderCurlTemplate, RESPONSE_FORMAT_SEPARATOR } from "../../app/curl-template";
import { logger } from "@neup/logica/logger";
import { redactLogSecrets } from "../../app/server-logger";
import { requestGeminiFlashLite, supportsModel as supportsGeminiFlashLite } from "./googleapis.gemini-3.1-flash-lite";

export type GoogleModelResponse = { output: string } | { error: string; status: number };

export const googleRequestFormat = {
  endpoint: "POST /v1beta/interactions",
  body: { model: "string", system_instruction: "string", input: "string" },
} as const;

export const googleResponseFormat = {
  output: "array of output steps; text is read from model_output steps",
} as const;

/** Built-in Interactions requests are intended for Gemini model IDs. */
export function supportsGoogleRequestModel(model: string) {
  return /^gemini-/i.test(model);
}

export function readGoogleResponse(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const response = result as { output?: unknown; output_text?: unknown; text?: unknown };
  if (typeof response.output_text === "string") return response.output_text;
  if (typeof response.text === "string") return response.text;
  if (typeof response.output === "string") return response.output;
  if (!Array.isArray(response.output)) return undefined;
  const text = response.output.flatMap((step) => {
    if (!step || typeof step !== "object") return [];
    const item = step as { type?: unknown; text?: unknown; content?: unknown };
    if (typeof item.text === "string" && (item.type === "text" || item.type === "model_output")) return [item.text];
    if (Array.isArray(item.content)) return item.content.flatMap((part) => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? [(part as { text: string }).text] : []);
    return [];
  }).join("");
  return text || undefined;
}

export type GoogleRequestConfig = {
  model: string;
  messages: ChatMessage[];
  systemInstruction?: string;
};

export function buildGoogleRequest({ model, messages, systemInstruction = instructions.default }: GoogleRequestConfig) {
  if (!supportsGoogleRequestModel(model)) throw new Error("Google Interactions requests require a Gemini model ID (gemini-…).");
  return {
    url: "https://generativelanguage.googleapis.com/v1beta/interactions",
    headers: { "Content-Type": "application/json" },
    body: {
      model,
      system_instruction: systemInstruction,
      input: messages.map(({ role, content }) => (role === "assistant" ? "Assistant: " : "User: ") + content).join("\n\n"),
    },
  };
}

/** Handles the complete Google API call, including model-specific formats. */
export async function requestGoogle({ model, apiKey, messages, requestFormat }: {
  model: string;
  apiKey: string;
  messages: ChatMessage[];
  requestFormat?: string | null;
}): Promise<GoogleModelResponse> {
  if (supportsGeminiFlashLite(model) && !requestFormat?.trim()) {
    return requestGeminiFlashLite({ apiKey, messages });
  }

  const chatHistory = compileChat(messages);
  const prompt = compileChatPrompt(messages, instructions.default);
  let url: string;
  let method = "POST";
  let headers = new Headers({ "Content-Type": "application/json" });
  let body: BodyInit | undefined;
  let responseFormat: string | null = null;
  const customFormat = requestFormat?.trim();

  try {
    if (customFormat) {
      const [curlTemplate, ...responseParts] = customFormat.split(RESPONSE_FORMAT_SEPARATOR);
      responseFormat = responseParts.length ? responseParts.join(RESPONSE_FORMAT_SEPARATOR).trim() : null;
      const curl = renderCurlTemplate(curlTemplate, { model, provider: "google", input: prompt, chathistory: chatHistory, apikey: apiKey });
      url = curl.url;
      method = curl.method;
      headers = curl.headers;
      body = curl.body;
      if (!curlTemplate.includes("{{apikey}}") && !headers.has("authorization") && !headers.has("x-api-key") && !headers.has("x-goog-api-key")) headers.set("x-goog-api-key", apiKey);
      if (!headers.has("content-type") && body !== undefined) headers.set("content-type", "application/json");
    } else {
      const request = buildGoogleRequest({ model, messages });
      url = request.url;
      body = JSON.stringify(request.body);
      for (const [name, value] of Object.entries(request.headers)) headers.set(name, value);
      headers.set("x-goog-api-key", apiKey);
    }

    const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(60_000) });
    const responseBody = await response.text();
    try { await logger.type("ai-response").data({ provider: "google", model, status: response.status, ok: response.ok, response: redactLogSecrets(responseBody, [apiKey]) }).log(); } catch { /* Logging must not interrupt provider response handling. */ }
    let result: any;
    try { result = JSON.parse(responseBody); } catch { result = null; }
    if (!response.ok) {
      const detail = typeof result?.error?.message === "string" ? result.error.message : typeof result?.message === "string" ? result.message : responseBody.slice(0, 500) || "The provider request failed.";
      return { error: detail, status: response.status >= 400 && response.status < 500 ? 502 : 503 };
    }
    const output = responseFormat ? extractOutputByFormat(responseBody, responseFormat) : readGoogleResponse(result) ?? (customFormat ? responseBody : undefined);
    return typeof output === "string" && output.trim() ? { output: output.trim() } : { error: "The provider returned an empty response.", status: 502 };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The Google request could not be completed.", status: 502 };
  }
}
