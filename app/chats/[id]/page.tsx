"use client";

import { useParams, useSearchParams } from "next/navigation";
import ChatPage from "../../chat/page";
import VoicePage from "../../voice/page";

export default function SavedChatPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = Number(rawId);

  if (!Number.isSafeInteger(id) || id < 1) {
    return <section className="chat-page"><div className="chat-error" role="alert"><p>Invalid chat ID.</p></div></section>;
  }

  return searchParams.get("mode") === "voice"
    ? <VoicePage initialChatId={id} />
    : <ChatPage initialChatId={id} />;
}
