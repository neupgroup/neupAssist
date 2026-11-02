import { redirect } from "next/navigation";

/** Sends legacy key management links to their settings destination. */
export default function LegacyManageKeysPage() {
  redirect("/settings/keys");
}
