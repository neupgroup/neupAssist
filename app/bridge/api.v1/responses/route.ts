import { NextResponse } from "next/server";
import { ensureAccount } from "@neup/shared/account/self";
import { prisma } from "@neup/core/database/prisma";
import { logApplicationError } from "@/app/server-logger";
import { requestResponsesModel, streamResponsesModel } from "@/services/models/responses";
import { defaultNvidiaModel } from "@/services/models/nvidia.default";

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

/** Selects the first configured provider credential with a usable model. */
async function getAutomaticCredential() {
  const credentials = await prisma.intelligenceKey.findMany({
    orderBy: { addedOn: "desc" },
    select: { provider: true, model: true, key: true },
  });
  for (const credential of credentials) {
    const provider = credential.provider.trim().toLowerCase();
    const model = credential.model?.trim() || (provider === "nvidia" ? defaultNvidiaModel : "");
    if (provider && model && credential.key.trim()) return { provider, model, apiKey: credential.key };
  }
  return null;
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

  const developmentToken = process.env.RESPONSES_DEV_API_TOKEN?.trim();
  const isDevelopmentToken = process.env.NODE_ENV === "development" && Boolean(developmentToken) && token === developmentToken;
  if (!isDevelopmentToken) {
    let account;
    try {
      account = await ensureAccount(token);
    } catch (error) {
      await logApplicationError(error, "POST /bridge/api.v1/responses authentication");
      return errorResponse("token_validation_failed", "The API token could not be validated.", 401);
    }
    if (!account) return errorResponse("invalid_x_token", "The x-token value was rejected. Check that the API token is correct and has not expired.", 401);
  }

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
  const input = parseResponseInput(payload.input);
  if (!input) return errorResponse("invalid_input", "Order input as system items, instruction-level items, then user items.", 400);

  try {
    const credential = await getAutomaticCredential();
    if (!credential) return errorResponse("no_ai_provider_configured", "No AI provider is configured.", 409);

    const responseId = `resp_${crypto.randomUUID().replaceAll("-", "")}`;
    if (payload.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const emit = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          try {
            const failure = await streamResponsesModel({
              ...credential,
              input,
              onText: (text) => emit({ success: true, data: { id: responseId, output: [{ type: "text", value: text }] } }),
            });
            if (failure) emit({ success: false, error: { code: "provider_request_failed", description: failure.error } });
            else emit({ success: true, data: { id: responseId, done: true } });
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

    const result = await requestResponsesModel({ ...credential, input });
    if ("error" in result) return errorResponse("provider_request_failed", result.error, result.status);

    return NextResponse.json({
      success: true,
      data: {
        id: responseId,
        createdAt: new Date().toISOString(),
        output: [{ type: "text", value: result.output }],
      },
    });
  } catch (error) {
    await logApplicationError(error, "POST /bridge/api.v1/responses");
    return errorResponse("provider_unavailable", "The configured AI provider could not complete the request.", 503);
  }
}
