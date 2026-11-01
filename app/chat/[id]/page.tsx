import { notFound } from "next/navigation";
import { getCookie } from "@neup/core/helpers/cookie";
import { ensureAccount } from "@neup/shared/account/self";
import { getRecentChat, listConnectedChatApps } from "@/services/chat";
import ChatPage from "../page";

export const dynamic = "force-dynamic";

/** Loads a saved chat's latest ten messages before rendering the chat page. */
export default async function SavedChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isSafeInteger(id) || id < 1) notFound();

  const account = await ensureAccount(await getCookie("auth_account"));
  const chat = await getRecentChat(id, 10);
  if (!chat) notFound();
  const apps = await listConnectedChatApps(account?.id);

  return <ChatPage initialChatId={chat.id} initialMessages={chat.messages} initialStatus={chat.status} initialApps={apps} />;
}
