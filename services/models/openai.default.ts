import type { ChatMessage } from "../chat";
import instructions from "../request/instructions.json";

export const openAIRequestFormat = {
  endpoint: "POST /v1/chat/completions",
  body: { model: "string", messages: "array of { role, content }" },
} as const;

export const openAIResponseFormat = {
  output: "choices[0].message.content (string or text content parts)",
} as const;

/** OpenAI's built-in Chat Completions adapter is for OpenAI model IDs. */
export function supportsOpenAIRequestModel(model: string) {
  return /^(gpt-|o[1-9]|chatgpt-)/i.test(model);
}

export function readOpenAIResponse(result: unknown): string | undefined {
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

export type OpenAIRequestConfig = {
  model: string;
  messages: ChatMessage[];
  systemInstruction?: string;
};

export function buildOpenAIRequest({ model, messages, systemInstruction = instructions.default }: OpenAIRequestConfig) {
  if (!supportsOpenAIRequestModel(model)) throw new Error("OpenAI Chat Completions requests require an OpenAI model ID (for example gpt-4o).");
  return {
    url: "https://api.openai.com/v1/chat/completions",
    headers: { "Content-Type": "application/json" },
    body: {
      model,
      messages: [
        { role: "system" as const, content: systemInstruction },
        ...messages,
      ],
    },
  };
}
