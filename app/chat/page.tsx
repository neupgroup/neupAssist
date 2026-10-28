"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@neup/components/ui/button";
import { Textarea } from "@neup/components/ui/textarea";
import { Icon } from "../ui-icon";

type Message = { role: "user" | "assistant"; text: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/manage/keys", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return false;
        const saved = await response.json();
        return Array.isArray(saved) && saved.some((entry) => Boolean(entry.model));
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
    setError("");
    setSetupRequired(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation.map(({ role, text: content }) => ({ role, content })) }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.setupRequired) setSetupRequired(true);
        throw new Error(result.error || "Nia couldn’t complete that request.");
      }
      setMessages((current) => [...current, { role: "assistant", text: result.reply }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nia couldn’t complete that request.");
    } finally {
      setSending(false);
    }
  }

  return <section className="chat-page">
    <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Chat</strong></div><div className="topbar-actions"><span className="model-status">{providerConfigured === null ? "Checking AI model…" : providerConfigured ? "AI model connected" : "No AI model connected"}</span>{providerConfigured === false && <Button variant="plain" size="sm" onClick={() => window.location.assign("/manage/keys")}>Connect</Button>}<Button variant="plain" size="icon" aria-label="More chat options" className="icon-button"><Icon name="more" size={19} /></Button></div></header>
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
        {message.role === "assistant" ? <span className="message-avatar"><Icon name="sparkles" size={14} /></span> : <span className="user-message-label">You</span>}
        <div className="message-body"><p>{message.text}</p>{message.role === "assistant" && <div className="message-tools"><Button variant="plain" size="icon" className="icon-button" aria-label="Copy response" onClick={async () => { await navigator.clipboard.writeText(message.text); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}</Button><Button variant="plain" size="icon" className="icon-button" aria-label="Good response"><Icon name="like" size={14} /></Button><Button variant="plain" size="icon" className="icon-button" aria-label="Bad response"><Icon name="dislike" size={14} /></Button></div>}</div>
      </article>)}{sending && <article className="message message-assistant"><span className="message-avatar"><Icon name="sparkles" size={14} /></span><div className="message-body"><p>Nia is thinking…</p></div></article>}{error && <div className="chat-error" role="alert"><p>{error}</p>{setupRequired && <Button variant="outlined" onClick={() => window.location.assign("/manage/keys")}>Manage provider keys</Button>}</div>}</div>}
    </div>
    <div className="composer-wrap"><form className="composer" onSubmit={sendMessage}>
      <Textarea ref={inputRef} value={draft} onChange={(event) => { setDraft(event.target.value); event.target.style.height = "auto"; event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`; }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Message Nia…" aria-label="Message Nia" rows={1} className="composer-input" />
      <div className="composer-footer"><div className="composer-tools"><Button type="button" variant="plain" size="icon" className="icon-button attach-button" aria-label="Attach a file"><Icon name="paperclip" size={17} /></Button><span className="composer-divider" /><span className="composer-hint">Nia can make mistakes. Check important info.</span></div><div className="composer-actions"><Button type="button" variant="plain" size="icon" className="icon-button voice-shortcut" aria-label="Open voice assistant" onClick={() => window.location.assign("/voice")}><Icon name="voice" size={17} /></Button><Button type="submit" variant="solid" size="icon" className="send-button" aria-label="Send message" disabled={!draft.trim() || sending}><Icon name="send" size={17} /></Button></div></div>
    </form><div className="composer-caption">Nia · Personal assistant</div></div>
  </section>;
}
