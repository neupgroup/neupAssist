import { NextResponse } from "next/server";
import { logger } from "@neup/logica/logger";
import { logApplicationError } from "../../server-logger";
import { prisma } from "../../../prisma/client/server";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };
const RESPONSE_FORMAT_SEPARATOR = "\n---response---\n";

function tokenizeCurl(command: string) {
  const tokens: string[] = [];
  let token = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (const char of command.trim()) {
    if (escaped) {
      // In shell cURL snippets, backslash-newline joins the following line.
      // Do not turn the line break into a spurious positional argument.
      if (char !== "\n" && char !== "\r") token += char;
      escaped = false;
    } else if (char === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (char === quote) quote = null;
      else token += char;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (/\s/.test(char)) {
      if (token) tokens.push(token);
      token = "";
    } else {
      token += char;
    }
  }
  if (escaped || quote) throw new Error("The cURL template has an unfinished quote or escape.");
  if (token) tokens.push(token);
  return tokens;
}

function renderCurlTemplate(template: string, values: { model: string; provider: string; input: string; apikey: string }) {
  const tokens = tokenizeCurl(template).map((token) => token
    .replaceAll("{{model}}", values.model)
    .replaceAll("{{provider}}", values.provider)
    .replaceAll("{{input}}", values.input)
    .replaceAll("{{apikey}}", values.apikey));
  if (tokens[0]?.toLowerCase() === "curl") tokens.shift();
  let url = "";
  let method = "GET";
  let data: string | undefined;
  const headers = new Headers();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const takeValue = (option: string) => {
      const value = tokens[++i];
      if (value === undefined) throw new Error(`The cURL option ${option} needs a value.`);
      return value;
    };
    if (["-s", "-S", "-sS", "-L", "--silent", "--show-error", "--location", "--compressed", "--fail"].includes(token)) continue;
    if (token === "-X" || token === "--request") method = takeValue(token).toUpperCase();
    else if (token === "-H" || token === "--header") {
      const header = takeValue(token);
      const separator = header.indexOf(":");
      if (separator < 1) throw new Error("cURL headers must use the format Name: value.");
      headers.set(header.slice(0, separator).trim(), header.slice(separator + 1).trim());
    } else if (["-d", "--data", "--data-raw", "--data-binary"].includes(token)) {
      data = takeValue(token);
      if (method === "GET") method = "POST";
    } else if (token === "--url") url = takeValue(token);
    else if (token.startsWith("-")) throw new Error(`Unsupported cURL option: ${token}`);
    else if (!url) url = token;
    else throw new Error("The cURL template includes an unsupported positional argument.");
  }

  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("cURL request URL must use HTTP or HTTPS.");
  return { url: parsedUrl.toString(), method, headers, body: data };
}

function extractOutputByFormat(responseText: string, format: string) {
  const marker = "__NIA_OUTPUT_VALUE__";
  const template = JSON.parse(format
    .replaceAll('"{{output}}"', JSON.stringify(marker))
    .replaceAll("{{output}}", JSON.stringify(marker))) as unknown;
  const response = JSON.parse(responseText) as unknown;
  const findMarker = (value: unknown, path: (string | number)[] = []): (string | number)[] | null => {
    if (value === marker) return path;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const found = findMarker(value[i], [...path, i]);
        if (found) return found;
      }
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        const found = findMarker(child, [...path, key]);
        if (found) return found;
      }
    }
    return null;
  };
  const path = findMarker(template);
  if (!path) throw new Error("Response format must include {{output}}.");
  let output = response;
  for (const segment of path) {
    if (output === null || typeof output !== "object" || !(segment in output)) throw new Error("The provider response did not match the configured response format.");
    output = (output as Record<string | number, unknown>)[segment];
  }
  if (typeof output === "string") return output;
  if (output === null || output === undefined) throw new Error("The configured {{output}} response value was empty.");
  return JSON.stringify(output);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const messages = body && typeof body === "object" ? (body as { messages?: unknown }).messages : null;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100 || messages.some((message) => !message || typeof message !== "object" || !["user", "assistant"].includes((message as ChatMessage).role) || typeof (message as ChatMessage).content !== "string")) {
    return NextResponse.json({ error: "Send a conversation containing user and assistant messages." }, { status: 400 });
  }

  try {
    const credentials = await prisma.intelligenceKey.findMany({
      orderBy: { addedOn: "desc" },
      select: { provider: true, model_id: true, key: true, modelInfo: { select: { model_name: true } } },
    });
    const models = await prisma.intelligenceModel.findMany({
      where: { status: { equals: "active", mode: "insensitive" } },
      orderBy: [{ order_index: "asc" }, { added_on: "asc" }],
      include: { provider: { select: { name: true, code: true, status: true, reqMethod: true } } },
    });
    const prioritized = models.flatMap((entry) => {
      if (entry.provider.status.toLowerCase() !== "active") return [];
      const credential = credentials.find((key) =>
        (key.provider.toLowerCase() === entry.provider.name.toLowerCase() || key.provider.toLowerCase() === entry.provider.code.toLowerCase())
        && (key.model_id === null || key.model_id === entry.id)
      );
      return credential ? [{ credential, model: entry.model_name, provider: entry.provider, reqMethod: entry.reqMethod ?? entry.provider.reqMethod }] : [];
    })[0];
    const explicit = credentials.find((entry) => entry.modelInfo && entry.provider.toLowerCase() === "openai")
      ?? credentials.find((entry) => Boolean(entry.modelInfo));
    const credential = prioritized?.credential ?? explicit;
    const model = prioritized?.model ?? explicit?.modelInfo?.model_name;

    if (!credential) {
      return NextResponse.json({ error: "Add an AI provider key in Manage keys to enable chat.", setupRequired: true }, { status: 409 });
    }

    const provider = prioritized?.provider.code.toLowerCase() ?? credential.provider.toLowerCase();

    if (!model) {
      return NextResponse.json({ error: "No active model with a configured provider key is available. Add a model and provider key in Manage.", setupRequired: true }, { status: 409 });
    }

    const endpoint = provider === "anthropic"
      ? "https://api.anthropic.com/v1/messages"
      : provider === "google"
        ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(credential.key)}`
        : provider === "mistral"
          ? "https://api.mistral.ai/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions";

    const normalizedMessages = messages as ChatMessage[];
    const providerRequest = provider === "anthropic"
      ? {
          model,
          max_tokens: 2048,
          system: "You are Nia, a thoughtful and helpful personal assistant. Be clear, warm, and accurate.",
          messages: normalizedMessages,
        }
      : provider === "google"
        ? {
            systemInstruction: { parts: [{ text: "You are Nia, a thoughtful and helpful personal assistant. Be clear, warm, and accurate." }] },
            contents: normalizedMessages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
          }
        : {
            model,
            messages: [{ role: "system", content: "You are Nia, a thoughtful and helpful personal assistant. Be clear, warm, and accurate." }, ...normalizedMessages],
          };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (provider === "anthropic") {
      headers["x-api-key"] = credential.key;
      headers["anthropic-version"] = "2023-06-01";
    } else if (provider !== "google") {
      headers.Authorization = `Bearer ${credential.key}`;
    }

    const configuredRequest = prioritized?.reqMethod?.trim();
    let responseFormat: string | null = null;
    let response: Response;
    if (configuredRequest) {
      const [curlTemplate, ...responseFormatParts] = configuredRequest.split(RESPONSE_FORMAT_SEPARATOR);
      responseFormat = responseFormatParts.length ? responseFormatParts.join(RESPONSE_FORMAT_SEPARATOR).trim() : null;
      const curl = renderCurlTemplate(curlTemplate, { model, provider: prioritized?.provider.name ?? credential.provider, input: JSON.stringify(normalizedMessages), apikey: credential.key });
      if (!curlTemplate.includes("{{apikey}}") && !curl.headers.has("authorization") && !curl.headers.has("x-api-key") && !curl.headers.has("x-goog-api-key")) {
        if (provider === "anthropic") curl.headers.set("x-api-key", credential.key);
        else if (provider === "google") curl.headers.set("x-goog-api-key", credential.key);
        else curl.headers.set("authorization", `Bearer ${credential.key}`);
      }
      if (!curl.headers.has("content-type") && curl.body !== undefined) curl.headers.set("content-type", "application/json");
      response = await fetch(curl.url, {
        method: curl.method,
        headers: curl.headers,
        body: curl.body,
        signal: AbortSignal.timeout(60_000),
      });
    } else {
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(providerRequest),
        signal: AbortSignal.timeout(60_000),
      });
    }
    const responseBody = await response.text();
    const result = (() => {
      try { return JSON.parse(responseBody); }
      catch { return null; }
    })();
    if (!response.ok) {
      const detail = typeof result?.error?.message === "string" ? result.error.message : typeof result?.message === "string" ? result.message : responseBody.slice(0, 500) || "The provider request failed.";
      await logApplicationError(
        new Error(`Provider returned HTTP ${response.status}: ${detail}`),
        `POST /api/chat · ${credential.provider} · ${model}`,
        [credential.key],
      );
      return NextResponse.json({ error: detail }, { status: response.status >= 400 && response.status < 500 ? 502 : 503 });
    }

    const text = responseFormat
      ? extractOutputByFormat(responseBody, responseFormat)
      : provider === "anthropic"
      ? result?.content?.find((part: { type?: string }) => part.type === "text")?.text
      : provider === "google"
        ? result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("")
        : result?.choices?.[0]?.message?.content ?? result?.output ?? result?.text ?? result?.response ?? (configuredRequest ? responseBody : undefined);

    if (typeof text !== "string" || !text.trim()) {
      await logApplicationError(
        new Error("Provider returned an empty response."),
        `POST /api/chat · ${credential.provider} · ${model}`,
        [credential.key],
      );
      return NextResponse.json({ error: "The provider returned an empty response." }, { status: 502 });
    }
    if (/high demand|rate.?limit|temporarily unavailable|overloaded|at capacity|service unavailable|try again later|internal server error/i.test(text)) {
      await logApplicationError(
        new Error(`Provider returned an error response: ${text.slice(0, 500)}`),
        `POST /api/chat · ${credential.provider} · ${model}`,
        [credential.key],
      );
    }
    try {
      await logger.type("ai-response").data({
        provider: credential.provider,
        model,
        response: text,
      }).log();
    } catch {
      // Logging failures must not affect the model response.
    }
    return NextResponse.json({ reply: text.trim(), provider: credential.provider, model });
  } catch (error) {
    await logApplicationError(error, "POST /api/chat");
    return NextResponse.json({ error: "Could not reach the configured AI provider. Check your saved key and try again." }, { status: 503 });
  }
}
