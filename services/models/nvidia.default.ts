import { spawn } from "node:child_process";
import type { ChatMessage } from "../chat";
import { buildSystemPrompt } from "../request/prompts";
import { logger } from "@neup/logica/logger";
import { logAIRequest, redactLogSecrets } from "../../app/server-logger";
import { modelId as nemotron35BoltE4BModel, requestNemotron35BoltE4B, supportsModel as supportsNemotron35BoltE4B } from "./nvidia.nemotron-3.5-bolt-e4b";
import { contextTools, includeToolDiscovery, type ToolDefinition, type ToolCall } from "@/services/tools";

export type NvidiaModelResponse = { output: string; toolCalls?: ToolCall[] } | { error: string; status: number };
export const defaultModel = nemotron35BoltE4BModel;
export const defaultNvidiaModel = defaultModel;

export const nvidiaRequestFormat = {
  endpoint: "POST /v1/chat/completions",
  body: { model: "string", messages: "array of role/content messages", stream: "boolean" },
} as const;

export const nvidiaResponseFormat = {
  output: "choices[0].message.content or streamed choices[].delta.content",
} as const;

/** Builds the standard NVIDIA Integrate chat completion request. */
export function buildNvidiaRequest({ model, messages, tools = contextTools }: { model: string; messages: ChatMessage[]; tools?: ToolDefinition[] }) {
  return {
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: {
      model,
      messages: [{ role: "system", content: buildSystemPrompt({ includeTextContext: false }) }, ...messages],
      max_tokens: 2048,
      stream: false,
      tools: includeToolDiscovery(tools).map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } })),
      tool_choice: "auto",
    },
  };
}

/** Reads the standard NVIDIA chat completion response. */
export function readNvidiaResponse(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const choices = (result as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return undefined;
  const message = (choices[0] as { message?: { content?: unknown } } | undefined)?.message;
  return typeof message?.content === "string" ? message.content : undefined;
}

/** Reads NVIDIA's OpenAI-compatible function calls from a completion response. */
export function readNvidiaToolCalls(result: unknown): ToolCall[] {
  if (!result || typeof result !== "object") return [];
  const choices = (result as { choices?: Array<{ message?: { tool_calls?: unknown[] } }> }).choices;
  const calls = choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const call = value as { id?: unknown; function?: { name?: unknown; arguments?: unknown } };
    if (typeof call.function?.name !== "string") return [];
    let args: unknown = call.function.arguments;
    if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
    return [{ id: typeof call.id === "string" ? call.id : `nvidia-tool-${index}`, name: call.function.name, arguments: args && typeof args === "object" && !Array.isArray(args) ? args as Record<string, unknown> : {} }];
  });
}

/** Streams a JSON request body to curl while passing request options as arguments. */
function invokeCurl({ url, headers, body }: { url: string; headers: Headers; body: string }): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const args = [
      "--silent", "--show-error", "--connect-timeout", "20", "--max-time", "180",
      "--no-buffer", "--request", "POST",
      ...Array.from(headers, ([name, value]) => ["--header", `${name}: ${value}`]).flat(),
      "--data-binary", "@-", "--write-out", "\\n__NEUP_HTTP_STATUS__:%{http_code}",
      "--url", url,
    ];
    const process = spawn("curl", args, { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    process.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    process.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    process.on("error", reject);
    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `curl exited with status ${code ?? "unknown"}.`));
        return;
      }

      const statusMarker = "__NEUP_HTTP_STATUS__:";
      const markerIndex = stdout.lastIndexOf(statusMarker);
      if (markerIndex < 0) {
        reject(new Error("curl did not return an HTTP status."));
        return;
      }

      const status = Number(stdout.slice(markerIndex + statusMarker.length).trim());
      resolve({ status, body: stdout.slice(0, markerIndex).replace(/\\n$/, "") });
    });
    process.stdin.end(body);
  });
}

/** Routes NVIDIA requests to the model-specific handler or default format. */
export async function requestNvidia({ model = defaultModel, apiKey, messages, tools = contextTools }: {
  model?: string;
  apiKey: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
}): Promise<NvidiaModelResponse> {
  if (model === defaultModel || supportsNemotron35BoltE4B(model) || model === nemotron35BoltE4BModel) return requestNemotron35BoltE4B({ apiKey, messages, tools });

  const request = buildNvidiaRequest({ model, messages, tools });
  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${apiKey}`);
  const body = JSON.stringify(request.body);

  try {
    await logAIRequest({ provider: "nvidia", model, url: request.url, method: "POST", headers, body, apiKey });
    const response = await invokeCurl({ url: request.url, headers, body });
    try {
      await logger.type("ai-response").data({
        provider: "nvidia",
        model,
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        response: redactLogSecrets(response.body, [apiKey]),
      }).log();
    } catch {
      // Logging must not interrupt provider response handling.
    }

    let result: unknown;
    try {
      result = JSON.parse(response.body);
    } catch {
      result = null;
    }
    if (response.status < 200 || response.status >= 300) {
      const errorBody = result as { error?: { message?: unknown }; message?: unknown } | null;
      const detail = typeof errorBody?.error?.message === "string"
        ? errorBody.error.message
        : typeof errorBody?.message === "string"
          ? errorBody.message
          : response.body.slice(0, 500) || "The NVIDIA request failed.";
      return { error: detail, status: response.status >= 400 && response.status < 500 ? 502 : 503 };
    }

    const toolCalls = readNvidiaToolCalls(result);
    const output = readNvidiaResponse(result);
    return toolCalls.length ? { output: output?.trim() ?? "", toolCalls } : output?.trim() ? { output: output.trim() } : { error: "The NVIDIA provider returned an empty response.", status: 502 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The NVIDIA request could not be completed.";
    try {
      await logger.type("ai-request-error").data({
        provider: "nvidia",
        model,
        transport: "curl",
        error: redactLogSecrets(message, [apiKey]),
      }).log();
    } catch {
      // Diagnostic logging must not affect provider fallback.
    }
    return { error: message, status: 502 };
  }
}
