import type { ChatTurn as ModelMessage } from "../request/chat";
import instructions from "../request/instructions.json";

export const modelId = "gemini-3.1-flash-lite";

export const requestFormat = {
  method: "POST",
  endpoint: "https://generativelanguage.googleapis.com/v1beta/interactions",
  headers: { "Content-Type": "application/json", "x-goog-api-key": "API key from the database" },
  body: {
    model: modelId,
    system_instruction: "string",
    input: "string",
  },
} as const;

export const responseFormat = {
  id: "string",
  model: "string",
  status: "completed",
  outputs: [{ type: "text", text: "string" }],
  usage: { total_tokens: "number" },
} as const;

export function supportsModel(model: string) {
  return model.toLowerCase() === modelId;
}

export function buildRequest(messages: ModelMessage[], systemInstruction = instructions.default) {
  return {
    url: requestFormat.endpoint,
    headers: { "Content-Type": "application/json" },
    body: {
      model: modelId,
      system_instruction: systemInstruction,
      input: messages.map(({ role, content }) => (role === "assistant" ? "Assistant: " : "User: ") + content).join("\n\n"),
    },
  };
}

export function readResponse(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const outputs = (result as { outputs?: unknown }).outputs;
  if (!Array.isArray(outputs)) return undefined;
  const text = outputs.flatMap((output) => {
    if (!output || typeof output !== "object") return [];
    const item = output as { type?: unknown; text?: unknown };
    return item.type === "text" && typeof item.text === "string" ? [item.text] : [];
  }).join("");
  return text || undefined;
}
