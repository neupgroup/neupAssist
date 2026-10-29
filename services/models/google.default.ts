import type { ChatMessage } from "../chat";
import prompts from "../request/prompts.json";
import { compileChat, compileChatPrompt } from "../request/chat";
import { extractOutputByFormat, renderCurlTemplate, RESPONSE_FORMAT_SEPARATOR } from "../../app/curl-template";
import { logger } from "@neup/logica/logger";
import { logAIRequest, redactLogSecrets } from "../../app/server-logger";
import { contextTools, includeToolDiscovery, type ToolCall } from "@/services/tools";

export type GoogleModelResponse = { output: string; toolCalls?: ToolCall[] } | { error: string; status: number };

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

export function buildGoogleRequest({ model, messages, systemInstruction = prompts.persona }: GoogleRequestConfig) {
  if (!supportsGoogleRequestModel(model)) throw new Error("Google Interactions requests require a Gemini model ID (gemini-…).");
  return {
    url: "https://generativelanguage.googleapis.com/v1beta/interactions",
    headers: { "Content-Type": "application/json" },
    body: {
      model,
      system_instruction: systemInstruction,
      input: messages.map(({ role, content }) => (role === "assistant" ? "Assistant: " : "User: ") + content).join("\n\n"),
      tools: includeToolDiscovery(contextTools).map(({ name, description, parameters }) => ({ type: "function", name, description, parameters })),
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
  const customFormat = requestFormat?.trim();
  const chatHistory = compileChat(messages);
  const prompt = compileChatPrompt(messages, customFormat ? `${prompts.persona}\n\n${prompts.textcontext}` : prompts.persona);
  let url: string;
  let method = "POST";
  let headers = new Headers({ "Content-Type": "application/json" });
  let body: BodyInit | undefined;
  let responseFormat: string | null = null;

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

    await logAIRequest({ provider: "google", model, url, method, headers, body, apiKey });
    const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(60_000) });
    const responseBody = await response.text();
    try { await logger.type("ai-response").data({ provider: "google", model, status: response.status, ok: response.ok, response: redactLogSecrets(responseBody, [apiKey]) }).log(); } catch { /* Logging must not interrupt provider response handling. */ }
    let result: any;
    try { result = JSON.parse(responseBody); } catch { result = null; }
    if (!response.ok) {
      const detail = typeof result?.error?.message === "string" ? result.error.message : typeof result?.message === "string" ? result.message : responseBody.slice(0, 500) || "The provider request failed.";
      return { error: detail, status: response.status >= 400 && response.status < 500 ? 502 : 503 };
    }
    const toolCalls = readGoogleToolCalls(result);
    const output = responseFormat ? extractOutputByFormat(responseBody, responseFormat) : readGoogleResponse(result) ?? (customFormat ? responseBody : undefined);
    return toolCalls.length ? { output: typeof output === "string" ? output.trim() : "", toolCalls } : typeof output === "string" && output.trim() ? { output: output.trim() } : { error: "The provider returned an empty response.", status: 502 };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The Google request could not be completed.", status: 502 };
  }
}

/** Reads function_call steps returned by Gemini Interactions. */
function readGoogleToolCalls(result: unknown): ToolCall[] {
  if (!result || typeof result !== "object") return [];
  const steps = (result as { steps?: unknown; output?: unknown }).steps ?? (result as { output?: unknown }).output;
  if (!Array.isArray(steps)) return [];
  return steps.flatMap((step, index) => {
    if (!step || typeof step !== "object") return [];
    const item = step as { type?: unknown; name?: unknown; id?: unknown; arguments?: unknown };
    if (item.type !== "function_call" || typeof item.name !== "string") return [];
    const args = item.arguments && typeof item.arguments === "object" && !Array.isArray(item.arguments) ? item.arguments as Record<string, unknown> : {};
    return [{ id: typeof item.id === "string" ? item.id : `google-tool-${index}`, name: item.name, arguments: args }];
  });
}
