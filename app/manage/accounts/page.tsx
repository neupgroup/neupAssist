import { redirect } from "next/navigation";

/** Sends legacy account management links to their settings destination. */
export default function LegacyManageAccountsPage() {
  redirect("/settings/accounts");
}
