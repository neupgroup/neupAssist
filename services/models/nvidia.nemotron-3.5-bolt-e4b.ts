import { spawn } from "node:child_process";
import type { ChatMessage } from "../chat";
import instructions from "../request/instructions.json";
import { logger } from "@neup/logica/logger";
import { logAIRequest, redactLogSecrets } from "../../app/server-logger";

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
      messages: [{ role: "system", content: instructions.default }, ...messages],
      temperature: 1,
      top_p: 0.95,
      max_tokens: 1024,
      seed: 42,
      stream: true,
      parallel_tool_calls: true,
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

/** Invokes curl with its request configuration supplied over standard input. */
function invokeCurl({ url, headers, body }: { url: string; headers: Headers; body: string }): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const config = [
      `url = ${JSON.stringify(url)}`,
      'request = "POST"',
      ...Array.from(headers, ([name, value]) => `header = ${JSON.stringify(`${name}: ${value}`)}`),
      `data-binary = ${JSON.stringify(body)}`,
      "max-time = 60",
    ].join("\n");
    const process = spawn("curl", [
      "--config", "-", "--silent", "--show-error", "--no-buffer",
      "--write-out", "\\n__NEUP_HTTP_STATUS__:%{http_code}",
    ], { stdio: ["pipe", "pipe", "pipe"] });
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
    process.stdin.end(config);
  });
}

/** Sends a Nemotron request and collects the streamed assistant response. */
export async function requestNemotron35BoltE4B({ apiKey, messages }: {
  apiKey: string;
  messages: ChatMessage[];
}): Promise<{ output: string } | { error: string; status: number }> {
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

    const output = readResponse(response.body);
    return output ? { output } : { error: "The NVIDIA provider returned an empty response.", status: 502 };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The NVIDIA request could not be completed.", status: 502 };
  }
}
