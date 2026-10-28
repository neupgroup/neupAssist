import { NextResponse } from "next/server";
import { logApplicationError } from "../../server-logger";
import { prisma } from "../../../prisma/client/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      select: { id: true, title: true, lastUpdated: true },
      orderBy: { lastUpdated: "desc" },
      take: 50,
    });
    return NextResponse.json(chats);
  } catch (error) {
    await logApplicationError(error, "GET /api/chats");
    return NextResponse.json({ error: "Could not load saved chats." }, { status: 503 });
  }
}
