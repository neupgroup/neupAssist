import { NextResponse } from "next/server";
import { logApplicationError } from "../../../server-logger";
import { prisma } from "../../../../prisma/client/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const providers = await prisma.intelligenceProvider.findMany({
      select: { id: true, name: true, code: true, created_on: true, status: true },
      orderBy: [{ created_on: "desc" }, { id: "desc" }],
    });
    return NextResponse.json(providers);
  } catch (error) {
    await logApplicationError(error, "GET /api/manage/providers");
    return NextResponse.json({ error: "Could not load providers. Check that the database is migrated and available." }, { status: 503 });
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
    return NextResponse.json({ error: "Provider name and code are required." }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const code = typeof data.code === "string" ? data.code.trim().toLowerCase() : "";
  const reqMethod = typeof data.reqMethod === "string" && data.reqMethod.trim() ? data.reqMethod : null;
  const status = typeof data.status === "string" ? data.status.trim().toLowerCase() : "active";
  if (!name || !/^[a-z0-9][a-z0-9_-]{1,49}$/.test(code) || !["active", "inactive"].includes(status)) {
    return NextResponse.json({ error: "Enter a name, a code using letters/numbers/dashes/underscores, and a valid status." }, { status: 400 });
  }
  try {
    const provider = await prisma.intelligenceProvider.create({
      data: { name, code, status, reqMethod },
      select: { id: true, name: true, code: true, created_on: true, status: true },
    });
    return NextResponse.json(provider, { status: 201 });
  } catch (error) {
    await logApplicationError(error, "POST /api/manage/providers");
    return NextResponse.json({ error: "Could not save this provider." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const id = Number(data.id);
  const status = typeof data.status === "string" ? data.status.trim().toLowerCase() : "";
  if (!Number.isSafeInteger(id) || id < 1 || !["active", "inactive"].includes(status)) {
    return NextResponse.json({ error: "A valid provider ID and status are required." }, { status: 400 });
  }
  try {
    return NextResponse.json(await prisma.intelligenceProvider.update({ where: { id }, data: { status } }));
  } catch (error) {
    await logApplicationError(error, "PATCH /api/manage/providers");
    return NextResponse.json({ error: "Could not update this provider." }, { status: 404 });
  }
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: "A valid provider ID is required." }, { status: 400 });
  }
  try {
    await prisma.intelligenceProvider.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    await logApplicationError(error, "DELETE /api/manage/providers");
    return NextResponse.json({ error: "Could not delete this provider." }, { status: 404 });
  }
}
