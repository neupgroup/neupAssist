import { redirect } from "next/navigation";

/** Sends the API settings destination directly to API key management. */
export default function ApiSettingsPage() {
  redirect("/settings/api/keys");
}
