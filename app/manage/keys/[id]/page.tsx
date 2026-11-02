import { redirect } from "next/navigation";

/** Sends legacy key detail links to their settings destination. */
export default async function LegacyManageKeyDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/settings/keys/${id}`);
}
