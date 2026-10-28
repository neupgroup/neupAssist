import "server-only";
import { requestGoogle } from "./google.default";
import { buildOpenAIRequest, readOpenAIResponse } from "./openai.default";
import { buildOpenRouterRequest, readOpenRouterResponse } from "./openrouter.default";
import instructions from "../request/instructions.json";
import { compileChat, compileChatPrompt, type ChatTurn } from "../request/chat";
import { extractOutputByFormat, renderCurlTemplate, RESPONSE_FORMAT_SEPARATOR } from "../../app/curl-template";
import { logger } from "@neup/logica/logger";
import { logAIRequest, redactLogSecrets } from "../../app/server-logger";

export type ModelMessage = ChatTurn;

export type ModelRequest = {
  provider: string;
  model: string;
  apiKey: string;
  messages: ModelMessage[];
  requestFormat?: string | null;
};

export type ModelResponse =
  | { output: string }
  | { error: string; status: number };

function readGenericResponse(provider: string, result: any): string | undefined {
  if (provider === "anthropic") return result?.content?.find((part: { type?: string }) => part.type === "text")?.text;
  if (provider === "openrouter") return readOpenRouterResponse(result);
  if (provider === "openai") return readOpenAIResponse(result);
  if (typeof result?.choices?.[0]?.message?.content === "string") return result.choices[0].message.content;
  return result?.output ?? result?.text ?? result?.response;
}

export async function requestModel({ provider: rawProvider, model, apiKey, messages, requestFormat }: ModelRequest): Promise<ModelResponse> {
  const provider = rawProvider.toLowerCase();
  if (provider === "google") return requestGoogle({ model, apiKey, messages, requestFormat });
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
      const curl = renderCurlTemplate(curlTemplate, { model, provider: rawProvider, input: prompt, chathistory: chatHistory, apikey: apiKey });
      url = curl.url;
      method = curl.method;
      headers = curl.headers;
      body = curl.body;
      if (!curlTemplate.includes("{{apikey}}") && !headers.has("authorization") && !headers.has("x-api-key") && !headers.has("x-goog-api-key")) {
        if (provider === "anthropic") headers.set("x-api-key", apiKey);
        else headers.set("authorization", `Bearer ${apiKey}`);
      }
      if (!headers.has("content-type") && body !== undefined) headers.set("content-type", "application/json");
    } else {
      if (provider === "openrouter") {
        const request = buildOpenRouterRequest({ model, messages });
        url = request.url;
        body = JSON.stringify(request.body);
        for (const [name, value] of Object.entries(request.headers)) headers.set(name, value);
        headers.set("authorization", `Bearer ${apiKey}`);
      } else if (provider === "openai") {
        const request = buildOpenAIRequest({ model, messages });
        url = request.url;
        body = JSON.stringify(request.body);
        for (const [name, value] of Object.entries(request.headers)) headers.set(name, value);
        headers.set("authorization", `Bearer ${apiKey}`);
      } else if (provider === "anthropic") {
        url = "https://api.anthropic.com/v1/messages";
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");
        body = JSON.stringify({ model, max_tokens: 2048, system: instructions.default, messages: [{ role: "user", content: chatHistory }] });
      } else {
        url = provider === "mistral" ? "https://api.mistral.ai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
        headers.set("authorization", `Bearer ${apiKey}`);
        body = JSON.stringify({ model, messages: [{ role: "user", content: prompt }] });
      }
    }

    await logAIRequest({ provider: rawProvider, model, url, method, headers, body, apiKey });
    const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(60_000) });
    const responseBody = await response.text();
    try { await logger.type("ai-response").data({ provider: rawProvider, model, status: response.status, ok: response.ok, response: redactLogSecrets(responseBody, [apiKey]) }).log(); } catch { /* Logging must not interrupt provider response handling. */ }
    let result: any;
    try { result = JSON.parse(responseBody); } catch { result = null; }
    if (!response.ok) {
      const detail = typeof result?.error?.message === "string" ? result.error.message : typeof result?.message === "string" ? result.message : responseBody.slice(0, 500) || "The provider request failed.";
      return { error: detail, status: response.status >= 400 && response.status < 500 ? 502 : 503 };
    }
    const output = responseFormat ? extractOutputByFormat(responseBody, responseFormat) : readGenericResponse(provider, result) ?? (customFormat ? responseBody : undefined);
    return typeof output === "string" && output.trim() ? { output: output.trim() } : { error: "The provider returned an empty response.", status: 502 };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The provider request could not be completed.", status: 502 };
  }
}
