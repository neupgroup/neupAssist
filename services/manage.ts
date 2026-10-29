import "server-only";
import { prisma } from "../prisma/client/server";
import { logServiceRun } from "@/services/service-logger";

export const listKeys = async () => {
  await logServiceRun("manage.keys.list");
  const keys = await prisma.intelligenceKey.findMany({
    select: { id: true, provider: true, model: true, key: true, addedOn: true, updatedOn: true, balance: true },
    orderBy: { addedOn: "desc" },
  });
  return keys.map(({ key, balance, ...entry }) => ({
    ...entry,
    keyPreview: key.length > 8 ? `${key.slice(0, 4)}••••${key.slice(-4)}` : "••••••••",
    balance: balance?.toString() ?? null,
  }));
};

export async function saveKey(data: Record<string, unknown>) {
  await logServiceRun("manage.keys.save", { provider: typeof data.provider === "string" ? data.provider : null });
  const provider = typeof data.provider === "string" ? data.provider.trim() : "";
  const model = typeof data.model === "string" ? data.model.trim() || null : null;
  const key = typeof data.key === "string" ? data.key.trim() : "";
  const uncapped = data.balance === null;
  const balance = typeof data.balance === "string" || typeof data.balance === "number" ? String(data.balance).trim() : "";
  if (!provider || !key || (!uncapped && (!balance || !/^\d+(\.\d{1,8})?$/.test(balance)))) {
    return { error: "Provider, key, and a valid balance (up to 8 decimal places) are required, or select Uncapped.", status: 400 } as const;
  }
  const created = await prisma.intelligenceKey.create({
    data: { provider, model, key, balance: uncapped ? null : balance },
    select: { id: true, provider: true, model: true, addedOn: true, updatedOn: true, balance: true },
  });
  return { ...created, balance: created.balance?.toString() ?? null };
}

export const deleteKey = async (id: number) => {
  await logServiceRun("manage.keys.delete", { id });
  await prisma.intelligenceKey.delete({ where: { id } });
  return { success: true };
};
