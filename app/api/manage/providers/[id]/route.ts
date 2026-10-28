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

export async function GET(_request: Request, context: RouteContext) {
  const id = await readId(context);
  if (!id) return NextResponse.json({ error: "A valid provider ID is required." }, { status: 400 });
  try {
    const provider = await prisma.intelligenceProvider.findUnique({
      where: { id },
      select: {
        id: true, name: true, code: true, created_on: true, status: true, reqMethod: true,
        models: { select: { id: true, name: true, code: true, status: true }, orderBy: [{ order_index: "asc" }, { added_on: "asc" }] },
      },
    });
    if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    return NextResponse.json(provider);
  } catch (error) {
    await logApplicationError(error, "GET /api/manage/providers/[id]");
    return NextResponse.json({ error: "Could not load this provider." }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const id = await readId(context);
  if (!id) return NextResponse.json({ error: "A valid provider ID is required." }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const code = typeof data.code === "string" ? data.code.trim().toLowerCase() : "";
  const status = typeof data.status === "string" ? data.status.trim().toLowerCase() : "";
  const reqMethod = typeof data.reqMethod === "string" && data.reqMethod.trim() ? data.reqMethod : null;
  if (!name || !/^[a-z0-9][a-z0-9_-]{1,49}$/.test(code) || !["active", "inactive"].includes(status)) {
    return NextResponse.json({ error: "Enter a name, a valid provider code, and status." }, { status: 400 });
  }
  try {
    const provider = await prisma.intelligenceProvider.update({
      where: { id },
      data: { name, code, status, reqMethod },
      select: {
        id: true, name: true, code: true, created_on: true, status: true, reqMethod: true,
        models: { select: { id: true, name: true, code: true, status: true }, orderBy: [{ order_index: "asc" }, { added_on: "asc" }] },
      },
    });
    return NextResponse.json(provider);
  } catch (error) {
    await logApplicationError(error, "PATCH /api/manage/providers/[id]");
    return NextResponse.json({ error: "Could not update this provider." }, { status: 404 });
  }
}
