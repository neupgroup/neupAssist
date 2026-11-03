import "server-only";
import { requestGoogle } from "./google.default";
import { requestNvidia } from "./nvidia.default";
import { requestGeminiFlashLite } from "./googleapis.gemini-3.1-flash-lite";
import { buildOpenAIRequest, readOpenAIResponse } from "./openai.default";
import { buildOpenRouterRequest, readOpenRouterResponse } from "./openrouter.default";
import { buildSystemPrompt } from "../request/prompts";
import { compileChat, compileChatPrompt, type ChatTurn } from "../request/chat";
import { extractOutputByFormat, renderCurlTemplate, RESPONSE_FORMAT_SEPARATOR } from "../../app/curl-template";
import { logger } from "@neup/logica/logger";
import { logAIRequest, redactLogSecrets } from "../../app/server-logger";
import { contextTools, includeToolDiscovery, type ToolCall, type ToolDefinition } from "@/services/tools";
import { resolveModelDefinition } from "./catalog";

export type ModelMessage = ChatTurn;

export type ModelRequest = {
  provider: string;
  model?: string;
  apiKey: string;
  messages: ModelMessage[];
  requestFormat?: string | null;
  tools?: ToolDefinition[];
};

export type ModelResponse =
  | { output: string; toolCalls?: ToolCall[] }
  | { error: string; status: number };

function readGenericResponse(provider: string, result: any): string | undefined {
  if (provider === "anthropic") return result?.content?.find((part: { type?: string }) => part.type === "text")?.text;
  if (provider === "openrouter") return readOpenRouterResponse(result);
  if (provider === "openai") return readOpenAIResponse(result);
  if (typeof result?.choices?.[0]?.message?.content === "string") return result.choices[0].message.content;
  return result?.output ?? result?.text ?? result?.response;
}

/** Reads OpenAI-compatible tool calls and Anthropic tool-use blocks. */
function readGenericToolCalls(provider: string, result: any): ToolCall[] {
  if (provider === "anthropic") {
    const blocks = Array.isArray(result?.content) ? result.content : [];
    return blocks.flatMap((block: any, index: number) => block?.type === "tool_use" && typeof block.name === "string"
      ? [{ id: typeof block.id === "string" ? block.id : `anthropic-tool-${index}`, name: block.name, arguments: block.input && typeof block.input === "object" && !Array.isArray(block.input) ? block.input : {} }]
      : []);
  }
  const calls = result?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls.flatMap((call: any, index: number) => {
    if (typeof call?.function?.name !== "string") return [];
    let args = call.function.arguments;
    if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
    return [{ id: typeof call.id === "string" ? call.id : `${provider}-tool-${index}`, name: call.function.name, arguments: args && typeof args === "object" && !Array.isArray(args) ? args : {} }];
  });
}

export async function requestModel({ provider: rawProvider, model, apiKey, messages, requestFormat, tools = contextTools }: ModelRequest): Promise<ModelResponse> {
  const modelDefinition = resolveModelDefinition(rawProvider, model ?? "");
  const provider = modelDefinition.provider;
  const modelName = modelDefinition.modelName;
  try { await logger.type("service-run").data({ service: "models.request", provider, model: model ?? modelName, modelName, messageCount: messages.length }).log(); } catch { /* Logging must not interrupt provider request handling. */ }
  if (provider === "google" && modelDefinition.fileName === "googleapis.gemini-3.1-flash-lite") return requestGeminiFlashLite({ apiKey, messages });
  if (provider === "google") return requestGoogle({ model: modelName, apiKey, messages, requestFormat, tools });
  if (provider === "nvidia") return requestNvidia({ model: modelName, apiKey, messages, tools });
  const chatHistory = compileChat(messages);
  const defaultSystemPrompt = buildSystemPrompt({ includeTextContext: true });
  const prompt = compileChatPrompt(messages, defaultSystemPrompt);
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
      const curl = renderCurlTemplate(curlTemplate, { model: modelName, provider, input: prompt, chathistory: chatHistory, apikey: apiKey });
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
        const request = buildOpenRouterRequest({ model: modelName, messages, tools });
        url = request.url;
        body = JSON.stringify(request.body);
        for (const [name, value] of Object.entries(request.headers)) headers.set(name, value);
        headers.set("authorization", `Bearer ${apiKey}`);
      } else if (provider === "openai") {
        const request = buildOpenAIRequest({ model: modelName, messages, tools });
        url = request.url;
        body = JSON.stringify(request.body);
        for (const [name, value] of Object.entries(request.headers)) headers.set(name, value);
        headers.set("authorization", `Bearer ${apiKey}`);
      } else if (provider === "anthropic") {
        url = "https://api.anthropic.com/v1/messages";
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");
        body = JSON.stringify({ model: modelName, max_tokens: 2048, system: defaultSystemPrompt, messages: [{ role: "user", content: chatHistory }], tools: includeToolDiscovery(tools).map(({ name, description, parameters }) => ({ name, description, input_schema: parameters })) });
      } else {
        url = provider === "mistral" ? "https://api.mistral.ai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
        headers.set("authorization", `Bearer ${apiKey}`);
        body = JSON.stringify({ model: modelName, messages: [{ role: "user", content: prompt }], tools: includeToolDiscovery(tools).map(({ name, description, parameters }) => ({ type: "function", function: { name, description, parameters } })), tool_choice: "auto" });
      }
    }

    await logAIRequest({ provider, model: modelName, url, method, headers, body, apiKey });
    const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(60_000) });
    const responseBody = await response.text();
    try { await logger.type("ai-response").data({ provider, model: modelName, status: response.status, ok: response.ok, response: redactLogSecrets(responseBody, [apiKey]) }).log(); } catch { /* Logging must not interrupt provider response handling. */ }
    let result: any;
    try { result = JSON.parse(responseBody); } catch { result = null; }
    if (!response.ok) {
      const detail = typeof result?.error?.message === "string" ? result.error.message : typeof result?.message === "string" ? result.message : responseBody.slice(0, 500) || "The provider request failed.";
      return { error: detail, status: response.status >= 400 && response.status < 500 ? 502 : 503 };
    }
    const toolCalls = readGenericToolCalls(provider, result);
    const output = responseFormat ? extractOutputByFormat(responseBody, responseFormat) : readGenericResponse(provider, result) ?? (customFormat ? responseBody : undefined);
    return toolCalls.length ? { output: typeof output === "string" ? output.trim() : "", toolCalls } : typeof output === "string" && output.trim() ? { output: output.trim() } : { error: "The provider returned an empty response.", status: 502 };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The provider request could not be completed.", status: 502 };
  }
}
