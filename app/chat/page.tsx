"use client";
import { chatClientService, keyClientService } from "../../services/client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@neup/components/ui/button";
import { Textarea } from "@neup/components/ui/textarea";
import { Icon } from "../ui-icon";
import { renderChatContent } from "@/components/chat/render";
import VoiceAssistant from "@/components/voice/voice-assistant";

type ToolFormatHint = { name: string; format: string; guidelines: string };
type Message = { role: "user" | "assistant"; text: string; toolFormats?: ToolFormatHint[] };
type RequestProgress = { type: "personalizing" } | { type: "connecting" | "communicating"; app: string; logo: string | null };

function ChatConversationPage({ initialChatId }: { initialChatId?: number } = {}) {
  const searchParams = useSearchParams();
  const requestedChatId = initialChatId ? String(initialChatId) : searchParams.get("chatId");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [requestProgress, setRequestProgress] = useState<RequestProgress | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([]);
    setChatId(null);
    if (!requestedChatId) return;
    let cancelled = false;
    chatClientService.get(Number(requestedChatId)).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load saved chat.");
      if (!cancelled) {
        setChatId(result.id);
        setMessages(result.messages);
      }
    }).catch((loadError) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load saved chat.");
    });
    return () => { cancelled = true; };
  }, [requestedChatId]);

  useEffect(() => {
    keyClientService.list()
      .then(async (response) => {
        if (!response.ok) return false;
        const saved = await response.json();
        return Array.isArray(saved) && saved.length > 0;
      })
      .then(setProviderConfigured)
      .catch(() => setProviderConfigured(false));
  }, []);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    const conversation = [...messages, { role: "user" as const, text }];
    setMessages(conversation);
    setDraft("");
    setSending(true);
    setRequestProgress(null);
    setError("");
    setSetupRequired(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
    try {
      const response = await chatClientService.send(conversation.map(({ role, text: content }) => ({ role, content })), chatId ?? undefined);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Nia couldn’t complete that request.");
      const decoder = new TextDecoder();
      let buffer = "";
      let result: Record<string, unknown> | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as { type: string; progress?: RequestProgress; result?: Record<string, unknown>; error?: string; setupRequired?: boolean };
          if (event.type === "progress" && event.progress) setRequestProgress(event.progress);
          else if (event.type === "final") result = event.result ?? null;
          else if (event.type === "error") { if (event.setupRequired) setSetupRequired(true); throw new Error(event.error || "Nia couldn’t complete that request."); }
        }
      }
      if (!result) throw new Error("Nia couldn’t complete that request.");
      setChatId(result.chatId as number);
      setMessages((current) => [...current, { role: "assistant", text: result.reply as string, toolFormats: Array.isArray(result.toolFormats) ? result.toolFormats as ToolFormatHint[] : [] }]);
      window.dispatchEvent(new Event("chats-updated"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nia couldn’t complete that request.");
    } finally {
      setSending(false);
    }
  }

  return <section className="chat-page">
    <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Chat</strong></div><div className="topbar-actions">{chatId && <Button variant="outlined" onClick={() => window.location.assign(`/chat/${chatId}?mode=voice`)}><Icon name="voice" size={16} /> Voice</Button>}<span className="model-status">{providerConfigured === null ? "Checking AI model…" : providerConfigured ? "AI model connected" : "No AI model connected"}</span>{providerConfigured === false && <Button variant="plain" size="sm" onClick={() => window.location.assign("/manage/keys")}>Connect</Button>}<Button variant="plain" size="icon" aria-label="More chat options" className="icon-button"><Icon name="more" size={19} /></Button></div></header>
    <div className="conversation-scroll">
      {messages.length === 0 ? <div className="chat-empty">
        <div className="greeting-icon"><Icon name="sparkles" size={21} /></div><p className="greeting-overline">YOUR PERSONAL ASSISTANT</p><h1>What can I help you<br className="desktop-break" /> with today?</h1><p className="greeting-copy">Ask anything, think something through, or get a little help with your day.</p>
        <div className="suggestion-grid">
          <button className="suggestion-card" onClick={() => setDraft("Help me plan a focused week")}><span className="suggestion-symbol sage">◷</span><span><strong>Plan my week</strong><small>Make room for what matters</small></span><span className="suggestion-arrow">↗</span></button>
          <button className="suggestion-card" onClick={() => setDraft("Help me think through a decision")}><span className="suggestion-symbol lilac">✳</span><span><strong>Think it through</strong><small>Talk through a decision</small></span><span className="suggestion-arrow">↗</span></button>
          <button className="suggestion-card" onClick={() => setDraft("Explain a tricky topic simply")}><span className="suggestion-symbol amber">⌘</span><span><strong>Learn something</strong><small>Make a tricky topic simple</small></span><span className="suggestion-arrow">↗</span></button>
          <button className="suggestion-card" onClick={() => setDraft("Help me write a thoughtful message")}><span className="suggestion-symbol blue">✎</span><span><strong>Write together</strong><small>Find the right words</small></span><span className="suggestion-arrow">↗</span></button>
        </div>
      </div> : <div className="message-list">{messages.map((message, index) => <article className={`message message-${message.role}`} key={`${index}-${message.role}`}>
        {message.role === "assistant" ? <span className="message-avatar"><Icon name="sparkles" size={20} /></span> : <span className="user-message-label">You</span>}
        <div className="message-body">{message.role === "assistant" ? renderChatContent(message.text, message.toolFormats) : <p>{message.text}</p>}{message.role === "assistant" && <div className="message-tools"><Button variant="plain" size="icon" className="icon-button" aria-label="Copy response" onClick={async () => { await navigator.clipboard.writeText(message.text); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? <Icon name="check" size={20} /> : <Icon name="copy" size={20} />}</Button><Button variant="plain" size="icon" className="icon-button" aria-label="Good response"><Icon name="like" size={20} /></Button><Button variant="plain" size="icon" className="icon-button" aria-label="Bad response"><Icon name="dislike" size={20} /></Button></div>}</div>
      </article>)}{sending && <article className="message message-assistant"><span className="message-avatar"><Icon name="sparkles" size={20} /></span><div className="message-body" aria-live="polite" aria-atomic="true">
        {!requestProgress && <p className="request-status">Nia is thinking…</p>}
        {requestProgress?.type === "personalizing" && <p className="request-status">Please wait while I personalize results for you.</p>}
        {(requestProgress?.type === "connecting" || requestProgress?.type === "communicating") && <div className="app-request-status request-status"><span className="app-request-logo">{requestProgress.logo ? <img src={requestProgress.logo} alt="" /> : <Icon name="code" size={16} />}</span><span>{requestProgress.type === "connecting" ? "Connecting to" : "Communicating to"} <strong>{requestProgress.app}</strong></span></div>}
      </div></article>}{error && <div className="chat-error" role="alert"><p>{error}</p>{setupRequired && <Button variant="outlined" onClick={() => window.location.assign("/manage/keys")}>Manage provider keys</Button>}</div>}</div>}
    </div>
    <div className="composer-wrap"><form className="composer" onSubmit={sendMessage}>
      <Textarea ref={inputRef} value={draft} onChange={(event) => { setDraft(event.target.value); event.target.style.height = "auto"; event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`; }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Message Nia…" aria-label="Message Nia" rows={1} className="composer-input" />
      <div className="composer-footer"><div className="composer-tools"><Button type="button" variant="plain" size="icon" className="icon-button attach-button" aria-label="Attach a file"><Icon name="paperclip" size={17} /></Button><span className="composer-divider" /><span className="composer-hint">Nia can make mistakes. Check important info.</span></div><div className="composer-actions"><Button type="button" variant="plain" size="icon" className="icon-button voice-shortcut" aria-label="Open voice assistant" onClick={() => window.location.assign(chatId ? `/chat/${chatId}?mode=voice` : "/chat?mode=voice")}><Icon name="voice" size={17} /></Button><Button type="submit" variant="solid" size="icon" className="send-button" aria-label="Send message" disabled={!draft.trim() || sending}><Icon name="send" size={17} /></Button></div></div>
    </form><div className="composer-caption">Nia · Personal assistant</div></div>
  </section>;
}

/** Selects voice mode or the regular chat view from the current chat URL. */
export default function ChatPage({ initialChatId }: { initialChatId?: number } = {}) {
  const searchParams = useSearchParams();
  if (searchParams.get("mode") === "voice") return <VoiceAssistant initialChatId={initialChatId} />;
  return <ChatConversationPage initialChatId={initialChatId} />;
}
