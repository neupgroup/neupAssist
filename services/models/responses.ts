import "server-only";
import { buildSystemPrompt } from "../request/prompts";
import { logger } from "@neup/logica/logger";
import { logAIRequest, redactLogSecrets } from "@/app/server-logger";
import { buildGoogleRequest, readGoogleResponse } from "./google.default";
import { buildNvidiaRequest, readNvidiaResponse } from "./nvidia.default";
import { buildOpenAIRequest, readOpenAIResponse } from "./openai.default";
import { buildOpenRouterRequest, readOpenRouterResponse } from "./openrouter.default";

export type ResponsePromptItem = { type: "text"; role: string; text: string };
type ProviderResponse = { output: string } | { error: string; status: number };

/** Combines the built-in system and persona with caller system instructions. */
function getSystemInstruction(input: ResponsePromptItem[]) {
  const callerSystem = input.filter(({ role }) => role === "system").map(({ text }) => text);
  return [`root: ${buildSystemPrompt({ includeTextContext: false })}`, ...callerSystem.map((text) => `system: ${text}`)].filter(Boolean).join("\n");
}

/** Supplies a minimal prompt when callers request a response without user text. */
function getUserMessages(input: ResponsePromptItem[]) {
  const userMessages = input.filter(({ role }) => role === "user").map(({ text }) => ({ role: "user" as const, content: text }));
  return userMessages.length ? userMessages : [{ role: "user" as const, content: "Respond according to the instructions above." }];
}

/** Creates role-specific messages for providers that accept multiple instruction levels. */
function getRoleMessages(input: ResponsePromptItem[], systemInstruction: string, includeDeveloperRole: boolean) {
  return [
    { role: "system", content: systemInstruction },
    ...input.filter(({ role }) => role !== "system" && role !== "user").map(({ role, text }) => ({
      role: includeDeveloperRole ? "developer" : "system",
      content: role === "developer" ? text : `${role} instructions:\n${text}`,
    })),
    ...getUserMessages(input),
  ];
}

/** Packs instruction levels into one system message for providers without developer roles. */
function getSingleInstructionMessages(input: ResponsePromptItem[], systemInstruction: string) {
  const instructions = input
    .filter(({ role }) => role !== "system" && role !== "user")
    .map(({ role, text }) => `${role} instructions:\n${text}`);
  return [
    { role: "system", content: [systemInstruction, ...instructions].filter(Boolean).join("\n\n") },
    ...getUserMessages(input),
  ];
}

/** Builds an API request for providers with native system, developer, and user roles. */
function buildMultiLevelRequest(provider: string, model: string, apiKey: string, input: ResponsePromptItem[], stream = false) {
  const systemInstruction = getSystemInstruction(input);
  const userMessages = getUserMessages(input);
  const roleMessages = getRoleMessages(input, systemInstruction, true);

  if (provider === "openai") {
    const request = buildOpenAIRequest({ model, messages: userMessages, systemInstruction, tools: [] });
    request.body.messages = roleMessages as unknown as typeof request.body.messages;
    (request.body as Record<string, unknown>).stream = stream;
    const headers = new Headers(request.headers);
    headers.set("authorization", `Bearer ${apiKey}`);
    return { url: request.url, headers, body: JSON.stringify(request.body) };
  }
  if (provider === "openrouter") {
    const request = buildOpenRouterRequest({ model, messages: userMessages, systemInstruction, tools: [] });
    request.body.messages = roleMessages as unknown as typeof request.body.messages;
    (request.body as Record<string, unknown>).stream = stream;
    const headers = new Headers(request.headers);
    headers.set("authorization", `Bearer ${apiKey}`);
    return { url: request.url, headers, body: JSON.stringify(request.body) };
  }
  if (provider === "nvidia") {
    const request = buildNvidiaRequest({ model, messages: userMessages, tools: [] });
    request.body.messages = getSingleInstructionMessages(input, systemInstruction) as unknown as typeof request.body.messages;
    (request.body as Record<string, unknown>).stream = stream;
    const headers = new Headers(request.headers);
    headers.set("authorization", `Bearer ${apiKey}`);
    return { url: request.url, headers, body: JSON.stringify(request.body) };
  }
  if (provider === "google") {
    const developerInstructions = input.filter(({ role }) => role !== "system" && role !== "user").map(({ role, text }) => `${role} instructions:\n${text}`);
    const request = buildGoogleRequest({
      model,
      messages: userMessages,
      systemInstruction: [systemInstruction, ...developerInstructions].filter(Boolean).join("\n\n"),
      tools: [],
    });
    (request.body as Record<string, unknown>).stream = stream;
    const headers = new Headers(request.headers);
    headers.set("x-goog-api-key", apiKey);
    return { url: request.url, headers, body: JSON.stringify(request.body) };
  }
  if (provider === "anthropic") {
    const developerInstructions = input.filter(({ role }) => role !== "system" && role !== "user").map(({ role, text }) => `${role} instructions:\n${text}`);
    const headers = new Headers({ "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" });
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers,
      body: JSON.stringify({ model, max_tokens: 2048, stream, system: [systemInstruction, ...developerInstructions].filter(Boolean).join("\n\n"), messages: userMessages }),
    };
  }

  const headers = new Headers({ "content-type": "application/json", authorization: `Bearer ${apiKey}` });
  const messages = provider === "mistral"
    ? getSingleInstructionMessages(input, systemInstruction)
    : getRoleMessages(input, systemInstruction, true);
  return {
    url: provider === "mistral" ? "https://api.mistral.ai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions",
    headers,
    body: JSON.stringify({ model, messages, stream }),
  };
}

/** Reads one provider's text delta from a streaming event payload. */
function readProviderTextDelta(provider: string, payload: any) {
  if (provider === "google") {
    if (payload?.delta?.type === "text" && typeof payload.delta.text === "string") return payload.delta.text;
    const parts = payload?.candidates?.[0]?.content?.parts;
    return Array.isArray(parts) ? parts.map((part: any) => typeof part?.text === "string" ? part.text : "").join("") : "";
  }
  if (provider === "anthropic") return typeof payload?.delta?.text === "string" ? payload.delta.text : "";
  const content = payload?.choices?.[0]?.delta?.content;
  if (typeof content === "string") return content;
  return Array.isArray(content) ? content.map((part: any) => typeof part?.text === "string" ? part.text : "").join("") : "";
}

/** Streams normalized text deltas from the configured provider. */
export async function streamResponsesModel({ provider: rawProvider, model, apiKey, input, onText }: {
  provider: string;
  model: string;
  apiKey: string;
  input: ResponsePromptItem[];
  onText: (text: string) => void;
}): Promise<{ error: string; status: number } | null> {
  const provider = rawProvider.toLowerCase();
  const request = buildMultiLevelRequest(provider, model, apiKey, input, true);

  try {
    await logAIRequest({ provider: rawProvider, model, url: request.url, method: "POST", headers: request.headers, body: request.body, apiKey });
    const response = await fetch(request.url, { method: "POST", headers: request.headers, body: request.body, signal: AbortSignal.timeout(60_000) });
    if (!response.ok || !response.body) {
      const body = await response.text();
      let payload: any;
      try { payload = JSON.parse(body); } catch { payload = null; }
      const detail = typeof payload?.error?.message === "string" ? payload.error.message : typeof payload?.message === "string" ? payload.message : body.slice(0, 500) || "The provider request failed.";
      return { error: detail, status: response.status >= 400 && response.status < 500 ? 502 : 503 };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamedText = false;
    const processEvent = (event: string) => {
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const payload = JSON.parse(raw);
          const text = readProviderTextDelta(provider, payload);
          if (text) { streamedText = true; onText(text); }
        } catch { /* Ignore non-JSON keepalive events. */ }
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) processEvent(event);
      if (done) break;
    }
    if (buffer.trim()) processEvent(buffer);
    return streamedText ? null : { error: "The provider returned an empty response.", status: 502 };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The provider request could not be completed.", status: 502 };
  }
}

/** Reads assistant text from the configured provider response shape. */
function readProviderOutput(provider: string, result: any) {
  if (provider === "google") return readGoogleResponse(result);
  if (provider === "nvidia") return readNvidiaResponse(result);
  if (provider === "openai") return readOpenAIResponse(result);
  if (provider === "openrouter") return readOpenRouterResponse(result);
  if (provider === "anthropic") return result?.content?.find((part: { type?: string }) => part.type === "text")?.text as string | undefined;
  return typeof result?.choices?.[0]?.message?.content === "string" ? result.choices[0].message.content : undefined;
}

/** Sends ordered response input, preserving roles where the provider supports them. */
export async function requestResponsesModel({ provider: rawProvider, model, apiKey, input }: {
  provider: string;
  model: string;
  apiKey: string;
  input: ResponsePromptItem[];
}): Promise<ProviderResponse> {
  const provider = rawProvider.toLowerCase();
  const request = buildMultiLevelRequest(provider, model, apiKey, input);
  try {
    await logAIRequest({ provider: rawProvider, model, url: request.url, method: "POST", headers: request.headers, body: request.body, apiKey });
    const response = await fetch(request.url, { method: "POST", headers: request.headers, body: request.body, signal: AbortSignal.timeout(60_000) });
    const responseBody = await response.text();
    try { await logger.type("ai-response").data({ provider: rawProvider, model, status: response.status, ok: response.ok, response: redactLogSecrets(responseBody, [apiKey]) }).log(); } catch { /* Logging must not interrupt provider response handling. */ }

    let payload: any;
    try { payload = JSON.parse(responseBody); } catch { payload = null; }
    if (!response.ok) {
      const detail = typeof payload?.error?.message === "string" ? payload.error.message : typeof payload?.message === "string" ? payload.message : responseBody.slice(0, 500) || "The provider request failed.";
      return { error: detail, status: response.status >= 400 && response.status < 500 ? 502 : 503 };
    }

    const output = readProviderOutput(provider, payload);
    return typeof output === "string" && output.trim() ? { output: output.trim() } : { error: "The provider returned an empty response.", status: 502 };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The provider request could not be completed.", status: 502 };
  }
}
