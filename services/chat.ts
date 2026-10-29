import "server-only";
import { prisma } from "@/prisma/client/server";
import { contextManager, isContextRequest } from "@/services/request/context-manager";
import { requestModel } from "@/services/models";
import { defaultNvidiaModel } from "@/services/models/nvidia.default";
import { logServiceRun } from "@/services/service-logger";
import { executeContextTool, formatToolResult } from "@/services/tools";

/** Lists the most recently updated chats. */
export async function listChats() {
  await logServiceRun("chat.list");
  return prisma.chat.findMany({ select: { id: true, title: true, lastUpdated: true }, orderBy: { lastUpdated: "desc" }, take: 50 });
}

/** Loads a chat and converts stored messages to the conversation format. */
export async function getChat(chatId: number) {
  await logServiceRun("chat.get", { chatId });
  const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { id: true, title: true, messages: { orderBy: { sent_on: "asc" }, select: { type: true, content: true } } } });
  if (!chat) return null;
  return { id: chat.id, title: chat.title, messages: chat.messages.map((message) => ({ role: message.type === "userSent" ? "user" as const : "assistant" as const, text: message.content })) };
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

type SavedCredential = {
  provider: string;
  model: string | null;
  key: string;
};

type ResolvedCredential = SavedCredential & { model: string };

/** Resolves provider defaults and returns at most one credential per provider. */
function getFallbackCredentials(credentials: SavedCredential[]): ResolvedCredential[] {
  const providers = new Set<string>();
  const resolved: ResolvedCredential[] = [];

  for (const credential of credentials) {
    const provider = credential.provider.trim().toLowerCase();
    const model = credential.model?.trim() || (provider === "nvidia" ? defaultNvidiaModel : "");
    if (!provider || !model || providers.has(provider)) continue;
    providers.add(provider);
    resolved.push({ ...credential, model });
    if (resolved.length === 5) break;
  }

  return resolved;
}

/** Tries saved providers in order and returns the first successful model response. */
async function requestWithFallback(credentials: ResolvedCredential[], messages: ChatMessage[]) {
  let lastFailure: { error: string; status: number } | null = null;

  for (const credential of credentials) {
    const provider = credential.provider.trim().toLowerCase();
    const model = credential.model.trim();
    const result = await requestModel({ provider, model, apiKey: credential.key, messages });
    if (!("error" in result)) return { result, provider: credential.provider, model } as const;
    lastFailure = result;
  }

  return {
    result: lastFailure ?? { error: "No saved AI provider is available.", status: 409 },
    provider: credentials[0]?.provider ?? "",
    model: credentials[0]?.model ?? "",
  } as const;
}

/** Sends a chat through saved providers, falling back across up to five providers. */
export async function sendChat(messages: ChatMessage[], requestedChatId?: number, onContextRequest?: (request: string) => void, authAccountToken?: string | null) {
  await logServiceRun("chat.send", { messageCount: messages.length, requestedChatId: requestedChatId ?? null });
  const credentials = await prisma.intelligenceKey.findMany({ orderBy: { addedOn: "desc" }, select: { provider: true, model: true, key: true } });
  const fallbackCredentials = getFallbackCredentials(credentials);
  if (fallbackCredentials.length === 0) return { error: "Add an AI provider key in Manage keys to enable chat.", status: 409, setupRequired: true } as const;
  const requestMessages = [...messages];
  const requestInstructions: string[] = [];
  const toolFormats: Array<{ name: string; format: string; guidelines: string }> = [];
  let text = "";
  let provider = fallbackCredentials[0].provider;
  let model = fallbackCredentials[0].model!;
  let chatId = requestedChatId;
  for (let turn = 0; turn < 6; turn += 1) {
    const attempt = await requestWithFallback(fallbackCredentials, requestMessages);
    if ("error" in attempt.result) return { ...attempt.result, provider: attempt.provider, model: attempt.model } as const;
    provider = attempt.provider;
    model = attempt.model;
    text = attempt.result.output;
    if (attempt.result.toolCalls?.length) {
      const toolResults = await Promise.all(attempt.result.toolCalls.map(async (toolCall) => {
        try {
          const data = await executeContextTool({ name: toolCall.name, authAccountToken });
          const result = formatToolResult({ name: toolCall.name, data });
          toolFormats.push({ name: result.name, format: result.format, guidelines: result.guidelines });
          return { id: toolCall.id, ...result };
        } catch (error) {
          return { id: toolCall.id, name: toolCall.name, error: error instanceof Error ? error.message : "The context tool failed." };
        }
      }));
      requestMessages.push({ role: "assistant", content: text || "I’m checking the requested information." });
      requestMessages.push({ role: "user", content: `Tool results:\n${JSON.stringify(toolResults)}` });
      requestInstructions.push(...toolResults.map(({ name }) => `tool:${name}`));
      if (turn === 5) text = "I couldn’t complete the information lookup after several requests. Please try asking in a different way.";
      continue;
    }
    const contextRequest = isContextRequest(text);
    if (!contextRequest) break;
    if (contextRequest) {
      requestInstructions.push(contextRequest);
      onContextRequest?.(contextRequest);
      const context = await contextManager.collect(contextRequest, authAccountToken);
      requestMessages.push({ role: "assistant", content: text });
      requestMessages.push({ role: "user", content: `Context data for ${contextRequest}:\n${JSON.stringify(context)}` });
    }
    if (turn === 5) {
      text = "I couldn’t complete the information lookup after several requests. Please try asking in a different way.";
      break;
    }
  }
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!latestUserMessage) return { error: "The conversation must include a user message.", status: 400 } as const;
  const title = latestUserMessage.content.trim().slice(0, 120) || "New chat";
  const chat = await prisma.$transaction(async (transaction) => {
    const saved = chatId === undefined ? await transaction.chat.create({ data: { title, status: "served" } }) : await transaction.chat.update({ where: { id: chatId }, data: { status: "served", lastUpdated: new Date() } });
    await transaction.message.createMany({ data: [
      { chat_id: saved.id, type: "userSent" as const, content: latestUserMessage.content },
      { chat_id: saved.id, type: "intelligenceReply" as const, content: text },
    ] });
    return saved;
  });
  return { reply: text, provider, model, chatId: chat.id, requests: requestInstructions, toolFormats } as const;
}
