import prompts from "@/services/request/prompts.json";

/** Combines the assistant persona with text-command guidance when required. */
export function buildSystemPrompt({ includeTextContext }: { includeTextContext: boolean }) {
  return [prompts.system, prompts.persona, includeTextContext ? prompts.textcontext : null].filter(Boolean).join("\n\n");
}

/** Returns only the base system prompt, without persona or chat-specific guidance. */
export function buildRootSystemPrompt() {
  return prompts.system;
}

/** Resolves persona template sections while keeping text-context guidance opt-in. */
export function resolvePromptSection(path = "") {
  const sections = prompts as Record<string, unknown>;
  const names = path ? path.split(".") : [];
  const base = [sections.system, sections.persona].filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join("\n\n");
  const extra = names
    .filter((name) => name !== "persona")
    .map((name) => sections[name]);
  if (extra.some((value) => typeof value !== "string" || !value.trim())) {
    const missing = names.find((name) => name !== "persona" && (typeof sections[name] !== "string" || !(sections[name] as string).trim()));
    throw new Error(`Unknown prompt section: ${missing}.`);
  }
  return [base, ...extra as string[]].filter(Boolean).join("\n\n");
}
