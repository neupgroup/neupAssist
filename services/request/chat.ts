export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Formats a conversation for providers that accept a single plain-text prompt. */
export function compileChat(messages: ChatTurn[]) {
  return messages
    .map(({ role, content }) => `${role === "assistant" ? "Nia" : "User"}: ${content.trim()}`)
    .join("\n\n");
}

/** Adds the configured persona to a compiled conversation. */
export function compileChatPrompt(messages: ChatTurn[], persona: string) {
  return `${persona.trim()}\n\n${compileChat(messages)}`;
}
