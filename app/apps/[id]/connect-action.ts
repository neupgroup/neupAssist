"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCookie } from "@neup/core/helpers/cookie";
import { prisma } from "@neup/core/database/prisma";
import { ensureAccount } from "@neup/shared/account/self";

/** Connects the signed-in account to an application using its existing catalog record. */
export async function connectApplication(formData: FormData) {
  const id = String(formData.get("applicationId") ?? "").trim();
  const destination = `/apps/${id}`;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) redirect("/apps");

  const application = await prisma.application.findUnique({ where: { id }, select: { id: true } });
  if (!application) redirect("/apps");
  const account = await ensureAccount(await getCookie("auth_account"));
  if (!account) redirect(`${destination}?connect=signin`);

  const existing = await prisma.integration.findFirst({
    where: { application_id: id, account_id: account.id },
    select: { id: true },
  });
  if (existing) {
    await prisma.integration.update({ where: { id: existing.id }, data: { status: "active", addedOn: new Date() } });
  } else {
    await prisma.integration.create({ data: { application_id: id, account_id: account.id, auth_info: "", status: "active" } });
  }

  revalidatePath("/apps");
  revalidatePath(destination);
  redirect(`${destination}?connected=1`);
}
