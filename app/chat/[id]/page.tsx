"use client";

import { useParams } from "next/navigation";
import ChatPage from "../page";

export default function SavedChatPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const id = Number(rawId);

  if (!Number.isSafeInteger(id) || id < 1) {
    return <section className="chat-page"><div className="chat-error" role="alert"><p>Invalid chat ID.</p></div></section>;
  }

  return <ChatPage initialChatId={id} />;
}
