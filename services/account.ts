import "server-only";
import { getAccountBasics } from "@neup/logica/account/lookup";
import { verifyNeupIdToken } from "@neup/logica/account/token/verify";
import { prisma } from "@/prisma/client/server";

/** Synchronizes the authenticated NeupID account into the local accounts table. */
export async function ensureAccount(authAccountToken: string | null | undefined) {
  const token = authAccountToken?.trim();
  if (!token) return null;

  const authentication = await verifyNeupIdToken(token);
  if (!authentication.valid || !authentication.payload.aid) return null;

  const id = authentication.payload.aid;
  const existingAccount = await prisma.account.findUnique({ where: { id } });

  try {
    const response = await getAccountBasics({
      accountId: id,
      fields: ["accountType", "displayName", "displayImage", "neupid"],
    });
    if (!response.ok || !response.body.success) return existingAccount;

    const basics = response.body;
    const type = basics.accountType?.trim() || existingAccount?.type || "unknown";
    const displayName = basics.displayName?.trim()
      || basics.neupid?.trim()
      || existingAccount?.displayName
      || "User";

    return prisma.account.upsert({
      where: { id },
      create: {
        id,
        type,
        displayName,
        displayImage: basics.displayImage ?? null,
        neupId: basics.neupid ?? null,
        status: "active",
      },
      update: {
        type,
        displayName,
        displayImage: basics.displayImage ?? existingAccount?.displayImage ?? null,
        neupId: basics.neupid ?? existingAccount?.neupId ?? null,
      },
    });
  } catch {
    return existingAccount;
  }
}
