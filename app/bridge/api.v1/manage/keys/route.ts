import { NextResponse } from "next/server";
import { logApplicationError } from "../../../server-logger";
import { prisma } from "../../../../prisma/client/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const keys = await prisma.intelligenceKey.findMany({
      select: {
        id: true, provider: true, model: true, key: true, addedOn: true, updatedOn: true, balance: true,
      },
      orderBy: { addedOn: "desc" },
    });

    return NextResponse.json(keys.map(({ key, balance, ...entry }) => ({
      ...entry,
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
  const model = typeof data.model === "string" ? data.model.trim() || null : null;
  const key = typeof data.key === "string" ? data.key.trim() : "";
  const uncapped = data.balance === null;
  const balance = typeof data.balance === "string" || typeof data.balance === "number" ? String(data.balance).trim() : "";

  if (!provider || !key || (!uncapped && (!balance || !/^\d+(\.\d{1,8})?$/.test(balance)))) {
    return NextResponse.json({ error: "Provider, key, and a valid balance (up to 8 decimal places) are required, or select Uncapped." }, { status: 400 });
  }

  try {
    const created = await prisma.intelligenceKey.create({
      data: { provider, model, key, balance: uncapped ? null : balance },
      select: { id: true, provider: true, model: true, addedOn: true, updatedOn: true, balance: true },
    });
    return NextResponse.json({ ...created, balance: created.balance?.toString() ?? null }, { status: 201 });
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
