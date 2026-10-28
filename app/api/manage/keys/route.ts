import { NextResponse } from "next/server";
import { logApplicationError } from "../../../server-logger";
import { prisma } from "../../../../prisma/client/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const keys = await prisma.intelligenceKey.findMany({
      select: {
        id: true, provider: true, model_id: true, key: true, addedOn: true, updatedOn: true, balance: true,
        modelInfo: { select: { model_name: true } },
      },
      orderBy: { addedOn: "desc" },
    });

    return NextResponse.json(keys.map(({ key, balance, modelInfo, ...entry }) => ({
      ...entry,
      model_name: modelInfo?.model_name ?? null,
      keyPreview: key.length > 8 ? `${key.slice(0, 4)}••••${key.slice(-4)}` : "••••••••",
      balance: balance?.toString() ?? null,
    })));
  } catch (error) {
    await logApplicationError(error, "GET /api/manage/keys");
    return NextResponse.json({ error: "Could not load saved keys. Check that the database is migrated and available." }, { status: 503 });
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
    return NextResponse.json({ error: "Please provide provider, key, and balance." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const provider = typeof data.provider === "string" ? data.provider.trim() : "";
  const modelId = data.model_id === null || data.model_id === undefined || data.model_id === "" ? null : Number(data.model_id);
  const key = typeof data.key === "string" ? data.key.trim() : "";
  const uncapped = data.balance === null;
  const balance = typeof data.balance === "string" || typeof data.balance === "number" ? String(data.balance).trim() : "";

  if (!provider || !key || (modelId !== null && (!Number.isSafeInteger(modelId) || modelId < 1)) || (!uncapped && (!balance || !/^\d+(\.\d{1,8})?$/.test(balance)))) {
    return NextResponse.json({ error: "Provider, key, and a valid balance (up to 8 decimal places) are required, or select Uncapped." }, { status: 400 });
  }

  try {
    if (modelId !== null) {
      const selectedModel = await prisma.intelligenceModel.findUnique({
        where: { id: modelId },
        include: { provider: { select: { name: true, code: true } } },
      });
      if (!selectedModel || (selectedModel.provider.name.toLowerCase() !== provider.toLowerCase() && selectedModel.provider.code.toLowerCase() !== provider.toLowerCase())) {
        return NextResponse.json({ error: "Choose a model belonging to the selected provider." }, { status: 400 });
      }
    }
    const created = await prisma.intelligenceKey.create({
      data: { provider, model_id: modelId, key, balance: uncapped ? null : balance },
      select: { id: true, provider: true, model_id: true, addedOn: true, updatedOn: true, balance: true, modelInfo: { select: { model_name: true } } },
    });
    return NextResponse.json({ ...created, model_name: created.modelInfo?.model_name ?? null, modelInfo: undefined, balance: created.balance?.toString() ?? null }, { status: 201 });
  } catch (error) {
    await logApplicationError(error, "POST /api/manage/keys");
    return NextResponse.json({ error: "Could not save the key. Check that the database is migrated and available." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: "A valid key ID is required." }, { status: 400 });
  }

  try {
    await prisma.intelligenceKey.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    await logApplicationError(error, "DELETE /api/manage/keys");
    return NextResponse.json({ error: "Could not delete this key. It may no longer exist." }, { status: 404 });
  }
}
