import { redirect } from "next/navigation";

/** Sends legacy log links to their settings destination. */
export default function LegacyManageLogsPage() {
  redirect("/settings/logs");
}
