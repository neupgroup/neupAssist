import { notFound } from "next/navigation";
import { getCookie } from "@neup/core/helpers/cookie";
import { ensureAccount } from "@neup/shared/account/self";
import { getRecentChat, listConnectedChatApps } from "@/services/chat";
import ChatPage from "../page";
import { getPublicAccountToken } from "@/services/request/auth";

export const dynamic = "force-dynamic";

/** Loads a saved chat's latest ten messages before rendering the chat page. */
export default async function SavedChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId)) notFound();

  const account = await ensureAccount(await getPublicAccountToken(getCookie));
  const chat = await getRecentChat(rawId, 10);
  if (!chat) notFound();
  const apps = await listConnectedChatApps(account?.id);

  return <ChatPage initialChatId={chat.id} initialMessages={chat.messages} initialStatus={chat.status} initialApps={apps} />;
}
