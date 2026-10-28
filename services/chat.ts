import "server-only";
import { prisma } from "@/prisma/client/server";
import { contextManager, isContextRequest } from "@/services/request/context-manager";
import { requestModel } from "@/services/models";

export async function listChats() {
  return prisma.chat.findMany({ select: { id: true, title: true, lastUpdated: true }, orderBy: { lastUpdated: "desc" }, take: 50 });
}

export async function getChat(chatId: number) {
  const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { id: true, title: true, messages: { orderBy: { sent_on: "asc" }, select: { type: true, content: true } } } });
  if (!chat) return null;
  return { id: chat.id, title: chat.title, messages: chat.messages.map((message) => ({ role: message.type === "userSent" ? "user" as const : "assistant" as const, text: message.content })) };
}

export type ChatMessage = { role: "user" | "assistant"; content: string };
export async function sendChat(messages: ChatMessage[], requestedChatId?: number, onContextRequest?: (request: string) => void) {
  const credentials = await prisma.intelligenceKey.findMany({ orderBy: { addedOn: "desc" }, select: { provider: true, model: true, key: true } });
  const credential = credentials.find((entry) => Boolean(entry.provider.trim() && entry.model?.trim()));
  if (!credential) return { error: "Add an AI provider key in Manage keys to enable chat.", status: 409, setupRequired: true } as const;
  const model = credential.model!;
  const provider = credential.provider.toLowerCase();
  const requestMessages = [...messages];
  const requestInstructions: string[] = [];
  let text = "";
  let chatId = requestedChatId;
  for (let turn = 0; turn < 6; turn += 1) {
    const result = await requestModel({ provider, model, apiKey: credential.key, messages: requestMessages });
    if ("error" in result) return { ...result, provider: credential.provider, model, key: credential.key } as const;
    text = result.output;
    const contextRequest = isContextRequest(text);
    if (!contextRequest) break;
    requestInstructions.push(contextRequest);
    onContextRequest?.(contextRequest);
    const context = await contextManager.collect(contextRequest);
    requestMessages.push({ role: "assistant", content: text });
    requestMessages.push({ role: "user", content: `Context data for ${contextRequest}:\n${JSON.stringify(context)}` });
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
  return { reply: text, provider: credential.provider, model, chatId: chat.id, requests: requestInstructions } as const;
}
