import { NextResponse } from "next/server";
import { ensureAccount } from "@neup/shared/account/self";
import { prisma } from "@neup/core/database/prisma";
import { logApplicationError } from "@/app/server-logger";
import { requestResponsesModel, streamResponsesModel } from "@/services/models/responses";
import { defaultModel as defaultGoogleModel } from "@/services/models/google.default";
import { defaultModel as defaultNvidiaModel } from "@/services/models/nvidia.default";
import { calculateModelUsageCost, resolveModelDefinition } from "@/services/models/catalog";

export const runtime = "nodejs";

type ResponseInputItem = { type: "text"; role: string; text: string };

/** Builds the shared error response envelope used by this API endpoint. */
function errorResponse(code: string, description: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ success: false, error: { code, description } }, { status, headers });
}

/** Parses and validates the ordered Responses API input array. */
function parseResponseInput(value: unknown): ResponseInputItem[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const input: ResponseInputItem[] = [];
  let currentRoleRank = 0;
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const candidate = item as Record<string, unknown>;
    if (candidate.type !== "text" || typeof candidate.role !== "string" || !candidate.role.trim() || typeof candidate.text !== "string" || !candidate.text.trim()) return null;
    const role = candidate.role.trim().toLowerCase();
    const rank = role === "system" ? 0 : role === "user" ? 2 : 1;
    if (rank < currentRoleRank) return null;
    currentRoleRank = rank;
    input.push({ type: "text", role, text: candidate.text.trim() });
  }

  return input;
}

type AutomaticCredential = { provider: string; model: string; apiKey: string };

/** Selects configured provider credentials in newest-first failover order. */
async function getAutomaticCredentials(failover: boolean): Promise<AutomaticCredential[]> {
  const credentials = await prisma.intelligenceKey.findMany({
    orderBy: { addedOn: "desc" },
    select: { provider: true, model: true, key: true },
  });
  const candidates: AutomaticCredential[] = [];
  const seenProviders = new Set<string>();
  for (const credential of credentials) {
    const provider = credential.provider.trim().toLowerCase();
    const model = credential.model?.trim() || (provider === "google" ? defaultGoogleModel : provider === "nvidia" ? defaultNvidiaModel : "");
    if (!provider || !model || !credential.key.trim()) continue;
    if (!failover && candidates.length) continue;
    if (!failover && !candidates.length) candidates.push({ provider, model, apiKey: credential.key });
    else if (failover && !seenProviders.has(`${provider}:${model}`)) {
      candidates.push({ provider, model, apiKey: credential.key });
      seenProviders.add(`${provider}:${model}`);
    }
  }
  return candidates;
}

/** Sends a non-streaming request to candidates until one returns a response. */
async function requestWithFailover(credentials: AutomaticCredential[], input: ResponseInputItem[]) {
  let lastFailure: { error: string; status: number } | null = null;
  for (const credential of credentials) {
    const modelDefinition = resolveModelDefinition(credential.provider, credential.model);
    const result = await requestResponsesModel({ ...credential, input });
    if (!("error" in result)) return { result, modelDefinition } as const;
    lastFailure = result;
  }
  return { result: lastFailure ?? { error: "No AI provider is configured.", status: 409 }, modelDefinition: null } as const;
}

/** Returns a consistent 405 response for methods this endpoint does not support. */
function methodNotAllowed() {
  return errorResponse("method_unavailable", "Method not allowed. Use POST to send a response request.", 405, { Allow: "POST" });
}

/** Rejects GET requests because this endpoint only accepts POST. */
export async function GET() {
  return methodNotAllowed();
}

/** Rejects PUT requests because this endpoint only accepts POST. */
export async function PUT() {
  return methodNotAllowed();
}

/** Rejects PATCH requests because this endpoint only accepts POST. */
export async function PATCH() {
  return methodNotAllowed();
}

/** Rejects DELETE requests because this endpoint only accepts POST. */
export async function DELETE() {
  return methodNotAllowed();
}

/** Rejects OPTIONS requests because this endpoint only accepts POST. */
export async function OPTIONS() {
  return methodNotAllowed();
}

/** Rejects HEAD requests because this endpoint only accepts POST. */
export async function HEAD() {
  return errorResponse("method_unavailable", "Method not allowed. Use POST to send a response request.", 405, { Allow: "POST" });
}

/** Runs caller input after the model layer's default system prompt. */
export async function POST(request: Request) {
  const rawToken = request.headers.get("x-token");
  if (rawToken === null) return errorResponse("missing_x_token", "Missing x-token header. Send your API token in the x-token header.", 401);
  const token = rawToken.trim();
  if (!token) return errorResponse("empty_x_token", "The x-token header is empty. Send a valid API token, not a blank value.", 401);
  if (["false", "null", "undefined"].includes(token.toLowerCase())) {
    return errorResponse("invalid_x_token_value", "The x-token header contains a false-like value. Check that your app passes the actual API token instead of false, null, or undefined.", 401);
  }

  let account;
  let callerKeyId: string | null = null;
  try {
    const apiKey = await prisma.callerKey.findFirst({
      where: { key: token, expired_on: { gt: new Date() } },
      select: { id: true, account: true },
    });
    account = apiKey?.account ?? await ensureAccount(token);
    callerKeyId = apiKey?.id ?? null;
  } catch (error) {
    await logApplicationError(error, "POST /bridge/api.v1/responses authentication");
    return errorResponse("token_validation_failed", "The API token could not be validated.", 401);
  }
  if (!account) return errorResponse("invalid_x_token", "The x-token value was rejected. Check that the API token is correct and has not expired.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_json", "Request body must be valid JSON.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return errorResponse("invalid_request_body", "Request body must be a JSON object.", 400);
  const payload = body as Record<string, unknown>;
  if (payload.model !== "auto") return errorResponse("unsupported_model", 'The model field must be "auto".', 400);
  if (typeof payload.stream !== "boolean") return errorResponse("invalid_stream_value", "The stream field must be true or false.", 400);
  if (payload.failover !== undefined && typeof payload.failover !== "boolean") return errorResponse("invalid_failover_value", "The failover field must be true or false.", 400);
  const input = parseResponseInput(payload.input);
  if (!input) return errorResponse("invalid_input", "Order input as system items, instruction-level items, then user items.", 400);

  try {
    const credentials = await getAutomaticCredentials(payload.failover === true);
    if (!credentials.length) return errorResponse("no_ai_provider_configured", "No AI provider is configured.", 409);
    const primaryModelDefinition = resolveModelDefinition(credentials[0].provider, credentials[0].model);

    /** Persists usage from a request authenticated with a managed caller key. */
    const saveCallerUsage = async (usage: { inputTokens: number; outputTokens: number }, modelFileName: string) => {
      if (!callerKeyId) return;
      try {
        await prisma.callerUsage.create({ data: {
          callerkey_id: callerKeyId,
          input_token: usage.inputTokens,
          output_token: usage.outputTokens,
          cost: calculateModelUsageCost(modelFileName, usage.inputTokens, usage.outputTokens),
        } });
      } catch (error) {
        await logApplicationError(error, "POST /bridge/api.v1/responses usage recording");
      }
    };

    const responseId = `resp_${crypto.randomUUID().replaceAll("-", "")}`;
    if (payload.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const emit = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          let emittedText = false;
          let lastFailure: { error: string; status: number } | null = null;
          try {
            for (const credential of credentials) {
              const modelDefinition = resolveModelDefinition(credential.provider, credential.model);
              const streamResult = await streamResponsesModel({
                provider: modelDefinition.provider,
                model: modelDefinition.modelName,
                apiKey: credential.apiKey,
                input,
                onText: (text) => {
                  emittedText = true;
                  emit({ success: true, data: { id: responseId, output: [{ type: "text", value: text }] } });
                },
              });
              if (streamResult && "error" in streamResult) {
                lastFailure = streamResult;
                if (emittedText || payload.failover !== true) break;
                continue;
              }
              if (streamResult && "usage" in streamResult) await saveCallerUsage(streamResult.usage, modelDefinition.fileName);
              emit({ success: true, data: { id: responseId, done: true } });
              lastFailure = null;
              break;
            }
            if (lastFailure) emit({ success: false, error: { code: "provider_request_failed", description: lastFailure.error } });
          } catch (error) {
            await logApplicationError(error, "POST /bridge/api.v1/responses streaming");
            emit({ success: false, error: { code: "provider_unavailable", description: "The configured AI provider could not complete the request." } });
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
    }

    const attempt = await requestWithFailover(credentials, input);
    if ("error" in attempt.result) return errorResponse("provider_request_failed", attempt.result.error, attempt.result.status);
    await saveCallerUsage(attempt.result.usage, attempt.modelDefinition?.fileName ?? primaryModelDefinition.fileName);

    return NextResponse.json({
      success: true,
      data: {
        id: responseId,
        createdAt: new Date().toISOString(),
        output: [{ type: "text", value: attempt.result.output }],
        usage: { input_tokens: attempt.result.usage.inputTokens, output_tokens: attempt.result.usage.outputTokens },
      },
    });
  } catch (error) {
    await logApplicationError(error, "POST /bridge/api.v1/responses");
    return errorResponse("provider_unavailable", "The configured AI provider could not complete the request.", 503);
  }
}
