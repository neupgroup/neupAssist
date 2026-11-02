import { NextResponse } from "next/server";
import { ensureAccount } from "@neup/shared/account/self";
import { prisma } from "@neup/core/database/prisma";
import { logApplicationError } from "@/app/server-logger";
import { requestModel } from "@/services/models";
import { defaultNvidiaModel } from "@/services/models/nvidia.default";

export const runtime = "nodejs";

type ResponseInputItem = { type: "text"; role: "system" | "developer" | "user"; text: string };

/** Parses and validates the ordered Responses API input array. */
function parseResponseInput(value: unknown): ResponseInputItem[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const input: ResponseInputItem[] = [];
  let currentRoleRank = 0;
  const roleRanks = { system: 0, developer: 1, user: 2 } as const;

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const candidate = item as Record<string, unknown>;
    if (candidate.type !== "text" || typeof candidate.role !== "string" || !Object.prototype.hasOwnProperty.call(roleRanks, candidate.role) || typeof candidate.text !== "string" || !candidate.text.trim()) return null;
    const role = candidate.role as ResponseInputItem["role"];
    const rank = roleRanks[role];
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

/** Runs caller input after the model layer's default system prompt. */
export async function POST(request: Request) {
  const token = request.headers.get("x-token")?.trim();
  if (!token) return NextResponse.json({ error: "The x-token header is required." }, { status: 401 });

  let account;
  try {
    account = await ensureAccount(token);
  } catch (error) {
    await logApplicationError(error, "POST /bridge/api.v1/responses authentication");
    return NextResponse.json({ error: "The API token could not be validated." }, { status: 401 });
  }
  if (!account) return NextResponse.json({ error: "The API token is invalid." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  const payload = body as Record<string, unknown>;
  if (payload.model !== "auto") return NextResponse.json({ error: 'The model field must be "auto".' }, { status: 400 });
  if (payload.stream !== false) return NextResponse.json({ error: "Streaming is not supported; set stream to false." }, { status: 400 });
  const input = parseResponseInput(payload.input);
  if (!input) return NextResponse.json({ error: "Input must contain text items ordered as system, developer, then user." }, { status: 400 });

  try {
    const credential = await getAutomaticCredential();
    if (!credential) return NextResponse.json({ error: "No AI provider is configured." }, { status: 409 });

    const orderedInput = input.map(({ role, text }) => `${role.toUpperCase()} prompt:\n${text}`).join("\n\n");
    const result = await requestModel({ ...credential, messages: [{ role: "user", content: orderedInput }], tools: [] });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const responseId = `resp_${crypto.randomUUID().replaceAll("-", "")}`;
    const messageId = `msg_${crypto.randomUUID().replaceAll("-", "")}`;
    return NextResponse.json({
      id: responseId,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "completed",
      model: credential.model,
      output: [{
        id: messageId,
        type: "message",
        status: "completed",
        role: "assistant",
        content: [{ type: "output_text", text: result.output, annotations: [] }],
      }],
      output_text: result.output,
    });
  } catch (error) {
    await logApplicationError(error, "POST /bridge/api.v1/responses");
    return NextResponse.json({ error: "The configured AI provider could not complete the request." }, { status: 503 });
  }
}
