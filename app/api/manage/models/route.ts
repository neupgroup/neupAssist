import { NextResponse } from "next/server";
import { logApplicationError } from "../../../server-logger";
import { prisma } from "../../../../prisma/client/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const models = await prisma.intelligenceModel.findMany({
      include: { provider: { select: { id: true, name: true, code: true } } },
      orderBy: [{ order_index: "asc" }, { added_on: "desc" }],
    });
    return NextResponse.json(models.map((model) => ({ ...model, cost_input: model.cost_input.toString(), cost_output: model.cost_output.toString() })));
  } catch (error) {
    await logApplicationError(error, "GET /api/manage/models");
    return NextResponse.json({ error: "Could not load models. Check that the database is migrated and available." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Provider ID, model name, costs, and status are required." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const provider_id = Number(data.provider_id);
  const model_name = typeof data.model_name === "string" ? data.model_name.trim() : "";
  const status = typeof data.status === "string" ? data.status.trim() : "";
  const cost_input = typeof data.cost_input === "string" || typeof data.cost_input === "number" ? String(data.cost_input).trim() : "";
  const cost_output = typeof data.cost_output === "string" || typeof data.cost_output === "number" ? String(data.cost_output).trim() : "";
  const validCost = (cost: string) => /^\d+(\.\d{1,8})?$/.test(cost);

  if (!Number.isSafeInteger(provider_id) || provider_id < 1 || !model_name || !["active", "inactive"].includes(status.toLowerCase()) || !validCost(cost_input) || !validCost(cost_output)) {
    return NextResponse.json({ error: "Select a provider, enter a model name and status, and provide valid non-negative costs (up to 8 decimal places)." }, { status: 400 });
  }

  try {
    const maximum = await prisma.intelligenceModel.aggregate({ _max: { order_index: true } });
    const model = await prisma.intelligenceModel.create({
      data: {
        provider_id,
        model_name,
        cost_input,
        cost_output,
        status,
        order_index: (maximum._max.order_index ?? -1) + 1,
      },
      include: { provider: { select: { id: true, name: true, code: true } } },
    });
    return NextResponse.json({ ...model, cost_input: model.cost_input.toString(), cost_output: model.cost_output.toString() }, { status: 201 });
  } catch (error) {
    await logApplicationError(error, "POST /api/manage/models");
    return NextResponse.json({ error: "Could not save this model. Check that the database is migrated and available." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const ids = body && typeof body === "object" ? (body as { ids?: unknown }).ids : null;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => !Number.isSafeInteger(id) || (id as number) < 1) || new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "Provide the ordered list of model IDs." }, { status: 400 });
  }

  try {
    const existing = await prisma.intelligenceModel.findMany({ select: { id: true } });
    if (existing.length !== ids.length || existing.some(({ id }) => !ids.includes(id))) {
      return NextResponse.json({ error: "The model list changed. Refresh and try again." }, { status: 409 });
    }
    await prisma.$transaction(ids.map((id, index) => prisma.intelligenceModel.update({
      where: { id: id as number },
      data: { order_index: index },
    })));
    return NextResponse.json({ success: true });
  } catch (error) {
    await logApplicationError(error, "PATCH /api/manage/models");
    return NextResponse.json({ error: "Could not save model order." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: "A valid model ID is required." }, { status: 400 });
  }
  try {
    await prisma.intelligenceModel.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    await logApplicationError(error, "DELETE /api/manage/models");
    return NextResponse.json({ error: "Could not delete this model. It may no longer exist." }, { status: 404 });
  }
}
