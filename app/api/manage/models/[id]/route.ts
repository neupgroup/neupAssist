import { NextResponse } from "next/server";
import { logApplicationError } from "../../../../server-logger";
import { prisma } from "../../../../../prisma/client/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function readId(context: RouteContext) {
  const { id } = await context.params;
  const value = Number(id);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

const modelSelect = {
  id: true,
  provider_id: true,
  name: true,
  code: true,
  cost_input: true,
  cost_output: true,
  reqMethod: true,
  status: true,
  order_index: true,
  added_on: true,
  provider: { select: { id: true, name: true, code: true } },
} as const;

function serializeModel<T extends { cost_input: { toString(): string }; cost_output: { toString(): string } }>(model: T) {
  return { ...model, cost_input: model.cost_input.toString(), cost_output: model.cost_output.toString() };
}

export async function GET(_request: Request, context: RouteContext) {
  const id = await readId(context);
  if (!id) return NextResponse.json({ error: "A valid model ID is required." }, { status: 400 });
  try {
    const model = await prisma.intelligenceModel.findUnique({ where: { id }, select: modelSelect });
    if (!model) return NextResponse.json({ error: "Model not found." }, { status: 404 });
    return NextResponse.json(serializeModel(model));
  } catch (error) {
    await logApplicationError(error, "GET /api/manage/models/[id]");
    return NextResponse.json({ error: "Could not load this model." }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const id = await readId(context);
  if (!id) return NextResponse.json({ error: "A valid model ID is required." }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const provider_id = Number(data.provider_id);
  const code = typeof data.code === "string" ? data.code.trim() : "";
  const cost_input = typeof data.cost_input === "string" || typeof data.cost_input === "number" ? String(data.cost_input).trim() : "";
  const cost_output = typeof data.cost_output === "string" || typeof data.cost_output === "number" ? String(data.cost_output).trim() : "";
  const status = typeof data.status === "string" ? data.status.trim().toLowerCase() : "";
  const reqMethod = typeof data.reqMethod === "string" && data.reqMethod.trim() ? data.reqMethod : null;
  const validCost = (cost: string) => /^\d+(\.\d{1,8})?$/.test(cost);
  if (!name || !code || !Number.isSafeInteger(provider_id) || provider_id < 1 || !validCost(cost_input) || !validCost(cost_output) || !["active", "inactive"].includes(status)) {
    return NextResponse.json({ error: "Enter a model name and code, provider, valid non-negative costs, and status." }, { status: 400 });
  }
  try {
    const updated = await prisma.intelligenceModel.update({
      where: { id },
      data: { name, code, provider_id, cost_input, cost_output, status, reqMethod },
      select: modelSelect,
    });
    return NextResponse.json(serializeModel(updated));
  } catch (error) {
    await logApplicationError(error, "PATCH /api/manage/models/[id]");
    return NextResponse.json({ error: "Could not update this model." }, { status: 404 });
  }
}
