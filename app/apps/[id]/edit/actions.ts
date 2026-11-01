"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@neup/core/database/prisma";
import { prisma } from "@neup/core/database/prisma";

export type UpdateApplicationState = { error?: string };

/** Validates and saves edits to an application catalog entry. */
export async function updateApplication(_state: UpdateApplicationState, formData: FormData): Promise<UpdateApplicationState> {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const authMethod = String(formData.get("authMethod") ?? "").trim();
  const moreDetails = String(formData.get("moreDetails") ?? "").trim();
  const displayImage = String(formData.get("displayImage") ?? "").trim();
  const coverImage = String(formData.get("coverImage") ?? "").trim();
  const endpointsText = String(formData.get("endpoints") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { error: "Application ID is invalid." };
  }
  if (!name || !description || !category || !instructions || !authMethod || !endpointsText) {
    return { error: "Complete all required fields." };
  }

  let endpoints: unknown;
  try {
    endpoints = JSON.parse(endpointsText);
  } catch {
    return { error: "Endpoints must be valid JSON." };
  }
  if (!Array.isArray(endpoints)) return { error: "Endpoints must be a JSON array." };

  try {
    await prisma.application.update({
      where: { id },
      data: {
        name,
        description,
        category,
        instructions,
        endpoints: endpoints as Prisma.InputJsonValue,
        authMethod,
        moreDetails: moreDetails || null,
        displayImage: displayImage || null,
        coverImage: coverImage || null,
      },
    });
  } catch {
    return { error: "Could not save this application. Check the database and try again." };
  }

  revalidatePath("/apps");
  revalidatePath(`/apps/${id}`);
  redirect(`/apps/${id}`);
}
