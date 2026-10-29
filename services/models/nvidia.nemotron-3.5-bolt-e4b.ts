import { spawn } from "node:child_process";
import type { Writable } from "node:stream";
import type { ChatMessage } from "../chat";
import prompts from "../request/prompts.json";
import { logger } from "@neup/logica/logger";
import { logAIRequest, redactLogSecrets } from "../../app/server-logger";
import { contextTools, includeToolDiscovery, type ToolCall } from "@/services/tools";

export const modelId = "nvidia/nemotron-3.5-bolt-e4b";
const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";

export const requestFormat = {
  method: "POST",
  endpoint: invokeUrl,
  headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: "Bearer API key from the database" },
  body: {
    model: modelId,
    messages: "system instruction followed by conversation messages",
    temperature: 1,
    top_p: 0.95,
    max_tokens: 1024,
    seed: 42,
    stream: true,
    parallel_tool_calls: true,
    tools: includeToolDiscovery(contextTools).map(({ name, description, parameters }) => ({ type: "function", function: { name, description, parameters } })),
    tool_choice: "auto",
    chat_template_kwargs: { enable_thinking: true },
  },
} as const;

export const responseFormat = {
  stream: "server-sent events; concatenate choices[].delta.content",
} as const;

/** Checks whether the requested ID uses the Nemotron Bolt E4B format. */
export function supportsModel(model: string) {
  return model.trim().toLowerCase() === modelId;
}

/** Builds the NVIDIA chat completion request for Nemotron Bolt E4B. */
export function buildRequest(messages: ChatMessage[]) {
  return {
    url: invokeUrl,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: {
      model: modelId,
      messages: [{ role: "system", content: prompts.persona }, ...messages],
      temperature: 1,
      top_p: 0.95,
      max_tokens: 1024,
      seed: 42,
      stream: true,
      parallel_tool_calls: true,
      tools: includeToolDiscovery(contextTools).map(({ name, description, parameters }) => ({ type: "function", function: { name, description, parameters } })),
      tool_choice: "auto",
      chat_template_kwargs: { enable_thinking: true },
    },
  };
}

/** Reads plain JSON or NVIDIA's streamed chat completion response. */
export function readResponse(responseBody: string): string | undefined {
  let output = "";
  const chunks = responseBody.split(/\r?\n/);

  for (const line of chunks) {
    const data = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
    if (!data || data === "[DONE]") continue;

    try {
      const result = JSON.parse(data) as {
        choices?: Array<{
          delta?: { content?: unknown };
          message?: { content?: unknown };
        }>;
        output?: unknown;
      };
      const choice = result.choices?.[0];
      const content = choice?.delta?.content ?? choice?.message?.content ?? result.output;
      if (typeof content === "string") output += content;
    } catch {
      // Ignore SSE metadata and incomplete/non-JSON lines.
    }
  }

  return output.trim() || undefined;
}

/** Collects streamed function call fragments from NVIDIA completion events. */
export function readToolCalls(responseBody: string): ToolCall[] {
  const calls = new Map<number, { id: string; name: string; arguments: string }>();
  for (const line of responseBody.split(/\r?\n/)) {
    const data = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
    if (!data || data === "[DONE]") continue;
    try {
      const result = JSON.parse(data) as { choices?: Array<{ delta?: { tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> } }> };
      for (const fragment of result.choices?.[0]?.delta?.tool_calls ?? []) {
        const index = fragment.index ?? calls.size;
        const call = calls.get(index) ?? { id: fragment.id ?? `nvidia-tool-${index}`, name: "", arguments: "" };
        if (fragment.id) call.id = fragment.id;
        call.name += fragment.function?.name ?? "";
        call.arguments += fragment.function?.arguments ?? "";
        calls.set(index, call);
      }
    } catch { /* Ignore incomplete SSE chunks. */ }
  }
  return [...calls.values()].flatMap(({ id, name, arguments: rawArguments }) => {
    if (!name) return [];
    try {
      const args: unknown = JSON.parse(rawArguments || "{}");
      return [{ id, name, arguments: args && typeof args === "object" && !Array.isArray(args) ? args as Record<string, unknown> : {} }];
    } catch { return [{ id, name, arguments: {} }]; }
  });
}

/** Sends curl options on a separate pipe and streams the JSON request body through stdin. */
function invokeCurl({ url, headers, body }: { url: string; headers: Headers; body: string }): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const config = [
      `url = ${JSON.stringify(url)}`,
      'request = "POST"',
      ...Array.from(headers, ([name, value]) => `header = ${JSON.stringify(`${name}: ${value}`)}`),
      "max-time = 180",
    ].join("\n");
    const process = spawn("curl", [
      "--config", "/dev/fd/3", "--silent", "--show-error", "--connect-timeout", "20",
      "--no-buffer", "--data-binary", "@-", "--write-out", "\\n__NEUP_HTTP_STATUS__:%{http_code}",
    ], { stdio: ["pipe", "pipe", "pipe", "pipe"] });
    const configStream = process.stdio[3] as Writable | null;
    if (!configStream) {
      process.kill();
      reject(new Error("curl configuration stream could not be opened."));
      return;
    }

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
    configStream.end(config);
    process.stdin.end(body);
  });
}

/** Sends a Nemotron request and collects the streamed assistant response. */
export async function requestNemotron35BoltE4B({ apiKey, messages }: {
  apiKey: string;
  messages: ChatMessage[];
}): Promise<{ output: string; toolCalls?: ToolCall[] } | { error: string; status: number }> {
  const request = buildRequest(messages);
  const headers = new Headers(request.headers);
  headers.set("authorization", `Bearer ${apiKey}`);
  const body = JSON.stringify(request.body);

  try {
    await logAIRequest({ provider: "nvidia", model: modelId, url: request.url, method: "POST", headers, body, apiKey });
    const response = await invokeCurl({ url: request.url, headers, body });
    try {
      await logger.type("ai-response").data({
        provider: "nvidia",
        model: modelId,
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        response: redactLogSecrets(response.body, [apiKey]),
      }).log();
    } catch {
      // Logging must not interrupt provider response handling.
    }

    if (response.status < 200 || response.status >= 300) {
      let detail = response.body.slice(0, 500) || "The NVIDIA request failed.";
      try {
        const errorBody = JSON.parse(response.body) as { error?: { message?: unknown }; message?: unknown };
        if (typeof errorBody.error?.message === "string") detail = errorBody.error.message;
        else if (typeof errorBody.message === "string") detail = errorBody.message;
      } catch {
        // Keep the response text as the provider error detail.
      }
      return { error: detail, status: response.status >= 400 && response.status < 500 ? 502 : 503 };
    }

    const toolCalls = readToolCalls(response.body);
    if (toolCalls.length) return { output: readResponse(response.body) ?? "", toolCalls };
    const output = readResponse(response.body);
    return output ? { output } : { error: "The NVIDIA provider returned an empty response.", status: 502 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The NVIDIA request could not be completed.";
    try {
      await logger.type("ai-request-error").data({
        provider: "nvidia",
        model: modelId,
        transport: "curl",
        error: redactLogSecrets(message, [apiKey]),
      }).log();
    } catch {
      // Diagnostic logging must not affect provider fallback.
    }
    return { error: message, status: 502 };
  }
}
