import type { ChatMessage } from "../chat";
import instructions from "../request/instructions.json";

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
