import { notFound } from "next/navigation";
import { getCookie } from "@neup/core/helpers/cookie";
import { ensureAccount } from "@/services/account";
import { getRecentChat } from "@/services/chat";
import ChatPage from "../page";

export const dynamic = "force-dynamic";

/** Loads a saved chat's latest ten messages before rendering the chat page. */
export default async function SavedChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isSafeInteger(id) || id < 1) notFound();

  await ensureAccount(await getCookie("auth_account"));
  const chat = await getRecentChat(id, 10);
  if (!chat) notFound();

  return <ChatPage initialChatId={chat.id} initialMessages={chat.messages} />;
}
