import "server-only";
import { prisma } from "../prisma/client/server";
import { compileChat, compileChatPrompt } from "./request/chat";
import { contextManager, isContextRequest } from "./request/context-manager";

export async function listChats() {
  return prisma.chat.findMany({ select: { id: true, title: true, lastUpdated: true }, orderBy: { lastUpdated: "desc" }, take: 50 });
}

export async function getChat(chatId: number) {
  const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { id: true, title: true, messages: { orderBy: { sent_on: "asc" }, select: { type: true, content: true } } } });
  if (!chat) return null;
  return { id: chat.id, title: chat.title, messages: chat.messages.map((message) => ({ role: message.type === "userSent" ? "user" as const : "assistant" as const, text: message.content })) };
}

export type ChatMessage = { role: "user" | "assistant"; content: string };
export async function sendChat(messages: ChatMessage[], requestedChatId?: number) {
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const requestedContext = lastAssistantMessage ? isContextRequest(lastAssistantMessage.content) : null;
  const pendingContextRequest = requestedContext ? [...messages].reverse().find((message) => message.role === "user")?.content : undefined;
  const isContextResponse = Boolean(requestedContext && pendingContextRequest?.startsWith("{\"request\":"));
  const credentials = await prisma.intelligenceKey.findMany({ orderBy: { addedOn: "desc" }, select: { provider: true, model_id: true, key: true, modelInfo: { select: { code: true, provider: { select: { code: true } } } } } });
  const models = await prisma.intelligenceModel.findMany({ where: { status: { equals: "active", mode: "insensitive" } }, orderBy: [{ order_index: "asc" }, { added_on: "asc" }], include: { provider: { select: { name: true, code: true, status: true, reqMethod: true } } } });
  const prioritized = models.flatMap((entry) => {
    if (entry.provider.status.toLowerCase() !== "active") return [];
    const credential = credentials.find((key) => (key.provider.toLowerCase() === entry.provider.name.toLowerCase() || key.provider.toLowerCase() === entry.provider.code.toLowerCase()) && (key.model_id === null || key.model_id === entry.id));
    return credential ? [{ credential, model: entry.code, provider: entry.provider, reqMethod: entry.reqMethod ?? entry.provider.reqMethod }] : [];
  })[0];
  const explicit = credentials.find((entry) => entry.modelInfo && entry.provider.toLowerCase() === "openai") ?? credentials.find((entry) => Boolean(entry.modelInfo));
  const credential = prioritized?.credential ?? explicit;
  const model = prioritized?.model ?? explicit?.modelInfo?.code;
  if (!credential) return { error: "Add an AI provider key in Manage keys to enable chat.", status: 409, setupRequired: true } as const;
  if (!model) return { error: "No active model with a configured provider key is available. Add a model and provider key in Manage.", status: 409, setupRequired: true } as const;
  const provider = prioritized?.provider.code.toLowerCase() ?? explicit?.modelInfo?.provider.code.toLowerCase() ?? credential.provider.toLowerCase();
  const endpoint = provider === "anthropic" ? "https://api.anthropic.com/v1/messages" : provider === "google" ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(credential.key)}` : provider === "mistral" ? "https://api.mistral.ai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const compiledChat = compileChat(messages);
  const persona = "You are Nia, a thoughtful and helpful personal assistant. Be clear, warm, and accurate.";
  const compiledPrompt = compileChatPrompt(messages, persona);
  const providerRequest = provider === "anthropic" ? { model, max_tokens: 2048, system: persona, messages: [{ role: "user", content: compiledChat }] } : provider === "google" ? { systemInstruction: { parts: [{ text: persona }] }, contents: [{ role: "user", parts: [{ text: compiledChat }] }] } : { model, messages: [{ role: "user", content: compiledPrompt }] };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "anthropic") { headers["x-api-key"] = credential.key; headers["anthropic-version"] = "2023-06-01"; }
  else if (provider !== "google") headers.Authorization = `Bearer ${credential.key}`;
  const { extractOutputByFormat, renderCurlTemplate, RESPONSE_FORMAT_SEPARATOR } = await import("../app/curl-template");
  const configuredRequest = prioritized?.reqMethod?.trim();
  let responseFormat: string | null = null;
  let response: Response;
  if (configuredRequest) {
    const [curlTemplate, ...responseFormatParts] = configuredRequest.split(RESPONSE_FORMAT_SEPARATOR);
    responseFormat = responseFormatParts.length ? responseFormatParts.join(RESPONSE_FORMAT_SEPARATOR).trim() : null;
    const curl = renderCurlTemplate(curlTemplate, { model, provider: prioritized?.provider.code ?? explicit?.modelInfo?.provider.code ?? credential.provider, input: compiledPrompt, chathistory: compiledChat, apikey: credential.key });
    if (!curlTemplate.includes("{{apikey}}") && !curl.headers.has("authorization") && !curl.headers.has("x-api-key") && !curl.headers.has("x-goog-api-key")) {
      if (provider === "anthropic") curl.headers.set("x-api-key", credential.key); else if (provider === "google") curl.headers.set("x-goog-api-key", credential.key); else curl.headers.set("authorization", `Bearer ${credential.key}`);
    }
    if (!curl.headers.has("content-type") && curl.body !== undefined) curl.headers.set("content-type", "application/json");
    response = await fetch(curl.url, { method: curl.method, headers: curl.headers, body: curl.body, signal: AbortSignal.timeout(60_000) });
  } else response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(providerRequest), signal: AbortSignal.timeout(60_000) });
  const responseBody = await response.text();
  const result = (() => { try { return JSON.parse(responseBody); } catch { return null; } })();
  if (!response.ok) {
    const detail = typeof result?.error?.message === "string" ? result.error.message : typeof result?.message === "string" ? result.message : responseBody.slice(0, 500) || "The provider request failed.";
    return { error: detail, status: response.status >= 400 && response.status < 500 ? 502 : 503, provider: credential.provider, model, key: credential.key } as const;
  }
  const text = responseFormat ? extractOutputByFormat(responseBody, responseFormat) : provider === "anthropic" ? result?.content?.find((part: { type?: string }) => part.type === "text")?.text : provider === "google" ? result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") : result?.choices?.[0]?.message?.content ?? result?.output ?? result?.text ?? result?.response ?? (configuredRequest ? responseBody : undefined);
  if (typeof text !== "string" || !text.trim()) return { error: "The provider returned an empty response.", status: 502, provider: credential.provider, model, key: credential.key } as const;
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!latestUserMessage) return { error: "The conversation must include a user message.", status: 400 } as const;
  const title = latestUserMessage.content.trim().slice(0, 120) || "New chat";
  const chat = await prisma.$transaction(async (transaction) => {
    const saved = requestedChatId === undefined ? await transaction.chat.create({ data: { title, status: "served" } }) : await transaction.chat.update({ where: { id: requestedChatId }, data: { status: "served", lastUpdated: new Date() } });
    await transaction.message.createMany({ data: [
      ...(requestedContext && !isContextResponse ? [] : [{ chat_id: saved.id, type: "userSent" as const, content: latestUserMessage.content }]),
      ...(requestedContext ? [] : [{ chat_id: saved.id, type: "intelligenceReply" as const, content: text.trim() }]),
    ] });
    return saved;
  });
  const reply = text.trim();
  if (requestedContext && !isContextResponse) {
    const resolvedRequest = isContextRequest(reply) ?? requestedContext;
    const context = await contextManager.collect(resolvedRequest);
    return { reply: "", contextRequest: resolvedRequest, context, provider: credential.provider, model, chatId: chat.id } as const;
  }
  return { reply, provider: credential.provider, model, chatId: chat.id } as const;
}
