import type { ChatMessage } from "../chat";
import { buildSystemPrompt } from "../request/prompts";
import { contextTools, includeToolDiscovery, type ToolDefinition } from "@/services/tools";

export const openRouterRequestFormat = {
  endpoint: "POST /api/v1/chat/completions",
  body: { model: "provider/model", messages: "array of { role, content }" },
} as const;

export const openRouterResponseFormat = {
  output: "choices[0].message.content (string or text content parts)",
} as const;

/** OpenRouter model IDs use provider/model slugs from its model catalog. */
export function supportsOpenRouterRequestModel(model: string) {
  return /^[^/\s]+\/[^/\s]+$/.test(model);
}

export function readOpenRouterResponse(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const choices = (result as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return undefined;
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return undefined;
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.flatMap((part) => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? [(part as { text: string }).text] : []).join("") || undefined;
  return undefined;
}

export type OpenRouterRequestConfig = {
  model: string;
  messages: ChatMessage[];
  systemInstruction?: string;
  tools?: ToolDefinition[];
};

export function buildOpenRouterRequest({ model, messages, systemInstruction = buildSystemPrompt({ includeTextContext: true }), tools = contextTools }: OpenRouterRequestConfig) {
  if (!supportsOpenRouterRequestModel(model)) throw new Error("OpenRouter model IDs must use the provider/model format, for example openai/gpt-4o.");
  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: { "Content-Type": "application/json" },
    body: {
      model,
      messages: [
        { role: "system" as const, content: systemInstruction },
        ...messages,
      ],
      tools: includeToolDiscovery(tools).map(({ name, description, parameters }) => ({ type: "function", function: { name, description, parameters } })),
      tool_choice: "auto",
    },
  };
}
