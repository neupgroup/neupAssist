"use client";
import { chatClientService, keyClientService } from "../../services/client";
import { withAppBasePath } from "../../services/app-url";

import { FormEvent, Suspense, type ReactNode, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@neup/components/ui/button";
import { Textarea } from "@neup/components/ui/textarea";
import { Icon } from "../ui-icon";
import { renderChatContent } from "@/components/chat/render";
import VoiceAssistant from "@/components/voice/voice-assistant";

type ToolFormatHint = { name: string; format: string; guidelines: string };
type Message = { role: "user" | "assistant"; text: string; toolFormats?: ToolFormatHint[] };
type RequestProgress = { type: "personalizing" } | { type: "connecting" | "communicating"; app: string; logo: string | null };
type ChatApp = { id: string; name: string; logo: string | null };
type MentionSpan = { start: number; end: number; appId: string };

/** Finds the app query currently being typed at the text cursor. */
function findActiveAppQuery(value: string, cursor: number) {
  const atPosition = value.lastIndexOf("@", cursor - 1);
  if (atPosition < 0 || (atPosition > 0 && /[\p{L}\p{N}_]/u.test(value[atPosition - 1]))) return null;
  const query = value.slice(atPosition + 1, cursor);
  if (/[\s@]/.test(query)) return null;
  return { start: atPosition, end: cursor, query };
}

/** Keeps selected app mentions aligned when text is inserted or removed. */
function updateMentionSpans(mentions: MentionSpan[], previousText: string, nextText: string): MentionSpan[] {
  let prefix = 0;
  while (prefix < previousText.length && prefix < nextText.length && previousText[prefix] === nextText[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < previousText.length - prefix && suffix < nextText.length - prefix && previousText[previousText.length - 1 - suffix] === nextText[nextText.length - 1 - suffix]) suffix += 1;
  const previousEditEnd = previousText.length - suffix;
  const delta = nextText.length - previousText.length;
  return mentions.flatMap((mention) => {
    if (mention.end <= prefix) return [mention];
    if (mention.start >= previousEditEnd) return [{ ...mention, start: mention.start + delta, end: mention.end + delta }];
    return [];
  });
}

/** Encodes selected visible app labels with their internal application IDs. */
function encodeSelectedAppMentions(text: string, mentions: MentionSpan[]): string {
  return [...mentions].sort((left, right) => right.start - left.start).reduce((content, mention) =>
    `${content.slice(0, mention.start)}@@{{{${mention.appId}}}}${content.slice(mention.end)}`, text);
}

/** Renders encoded app IDs as readable @appname mentions in user messages. */
function renderUserMessage(text: string, apps: ChatApp[]): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(/@@\{\{\{([^{}]+)\}\}\}/g)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    const app = apps.find(({ id }) => id === match[1]);
    nodes.push(<span key={`app-mention-${index++}`} className="chat-app-mention">@{app?.name ?? match[1]}</span>);
    cursor = start + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function ChatConversationPage({ initialChatId, initialMessages, initialStatus, initialApps }: { initialChatId?: string; initialMessages?: Message[]; initialStatus?: string; initialApps?: ChatApp[] } = {}) {
  const searchParams = useSearchParams();
  const requestedChatId = initialChatId ? String(initialChatId) : searchParams.get("chatId");
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? []);
  const [chatId, setChatId] = useState<string | null>(initialChatId ?? null);
  const [retryPendingOnOpen, setRetryPendingOnOpen] = useState(initialStatus === "toserve");
  const [draft, setDraft] = useState("");
  const [apps, setApps] = useState<ChatApp[]>(initialApps ?? []);
  const [draftMentions, setDraftMentions] = useState<MentionSpan[]>([]);
  const [activeAppQuery, setActiveAppQuery] = useState<{ start: number; end: number; query: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [requestProgress, setRequestProgress] = useState<RequestProgress | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialApps !== undefined) {
      setApps(initialApps);
      return;
    }
    let cancelled = false;
    chatClientService.listApps().then(async (response) => {
      if (!response.ok) return [];
      const result: unknown = await response.json();
      return Array.isArray(result) ? result as ChatApp[] : [];
    }).then((result) => { if (!cancelled) setApps(result); }).catch(() => { if (!cancelled) setApps([]); });
    return () => { cancelled = true; };
  }, [initialApps]);

  useEffect(() => {
    if (initialMessages !== undefined) {
      setMessages(initialMessages);
      setChatId(initialChatId ?? null);
      setRetryPendingOnOpen(initialStatus === "toserve");
      return;
    }
    setMessages([]);
    setChatId(null);
    setRetryPendingOnOpen(false);
    if (!requestedChatId) return;
    let cancelled = false;
    chatClientService.get(requestedChatId).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load saved chat.");
      if (!cancelled) {
        setChatId(result.id);
        setMessages(result.messages);
        setRetryPendingOnOpen(result.status === "toserve");
      }
    }).catch((loadError) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load saved chat.");
    });
    return () => { cancelled = true; };
  }, [requestedChatId, initialChatId, initialMessages, initialStatus]);

  useEffect(() => {
    if (!retryPendingOnOpen || !chatId || sending) return;
    const pendingChatId = chatId;
    setRetryPendingOnOpen(false);
    setSending(true);
    setRequestProgress(null);
    setError("");
    setSetupRequired(false);
    async function retryPendingResponse() {
      try {
        const response = await chatClientService.send([], pendingChatId, true);
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
            else if (event.type === "error") {
              if (event.setupRequired) setSetupRequired(true);
              throw new Error(event.error || "Nia couldn’t complete that request.");
            }
          }
        }
        if (!result) throw new Error("Nia couldn’t complete that request.");
        if (typeof result.reply === "string" && result.reply.trim()) {
          setMessages((current) => [...current, { role: "assistant", text: result.reply as string, toolFormats: Array.isArray(result.toolFormats) ? result.toolFormats as ToolFormatHint[] : [] }]);
        } else {
          setError("Nia returned an empty response. This chat will retry when you open it again.");
        }
        window.dispatchEvent(new Event("chats-updated"));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Nia couldn’t complete that request.");
      } finally {
        setSending(false);
      }
    }
    void retryPendingResponse();
  }, [retryPendingOnOpen, chatId, sending]);

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
    setRetryPendingOnOpen(false);
    const content = encodeSelectedAppMentions(text, draftMentions);
    const conversation = [...messages, { role: "user" as const, text: content }];
    setMessages(conversation);
    setDraft("");
    setDraftMentions([]);
    setActiveAppQuery(null);
    setSending(true);
    setRequestProgress(null);
    setError("");
    setSetupRequired(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
    try {
      const response = await chatClientService.send(conversation.map(({ role, text: messageContent }) => ({ role, content: messageContent })), chatId ?? undefined);
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
          const event = JSON.parse(line) as { type: string; progress?: RequestProgress; result?: Record<string, unknown>; error?: string; setupRequired?: boolean; chatId?: string };
          if (event.type === "progress" && event.progress) setRequestProgress(event.progress);
          else if (event.type === "saved" && event.chatId) {
            setChatId(event.chatId);
            window.dispatchEvent(new Event("chats-updated"));
          }
          else if (event.type === "final") result = event.result ?? null;
          else if (event.type === "error") { if (event.setupRequired) setSetupRequired(true); throw new Error(event.error || "Nia couldn’t complete that request."); }
        }
      }
      if (!result) throw new Error("Nia couldn’t complete that request.");
      setChatId(result.chatId as string);
      if (typeof result.reply === "string" && result.reply.trim()) {
        setMessages((current) => [...current, { role: "assistant", text: result.reply as string, toolFormats: Array.isArray(result.toolFormats) ? result.toolFormats as ToolFormatHint[] : [] }]);
      } else {
        setError("Nia returned an empty response. This chat will retry when you open it again.");
      }
      window.dispatchEvent(new Event("chats-updated"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nia couldn’t complete that request.");
    } finally {
      setSending(false);
    }
  }

  /** Replaces the active @query with a selected app mention. */
  function selectMentionedApp(app: ChatApp) {
    const textarea = inputRef.current;
    if (!textarea || !activeAppQuery) return;
    const { start } = activeAppQuery;
    let end = activeAppQuery.end;
    while (end < draft.length && !/\s/.test(draft[end])) end += 1;
    const label = `@${app.name}`;
    const insertion = `${label} `;
    const nextDraft = `${draft.slice(0, start)}${insertion}${draft.slice(end)}`;
    const delta = insertion.length - (end - start);
    const retainedMentions = draftMentions.flatMap((mention) => {
      if (mention.end <= start) return [mention];
      if (mention.start >= end) return [{ ...mention, start: mention.start + delta, end: mention.end + delta }];
      return [];
    });
    setDraft(nextDraft);
    setDraftMentions([...retainedMentions, { start, end: start + label.length, appId: app.id }]);
    setActiveAppQuery(null);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    });
  }

  const matchingApps = activeAppQuery
    ? apps.filter((app) => app.name.toLocaleLowerCase().includes(activeAppQuery.query.toLocaleLowerCase()))
    : [];

  return <section className="chat-page">
    <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Chat</strong></div><div className="topbar-actions">{chatId && <Button variant="outlined" onClick={() => window.location.assign(withAppBasePath(`/chat/${chatId}?mode=voice`))}><Icon name="voice" size={16} /> Voice</Button>}<span className="model-status">{providerConfigured === null ? "Checking AI model…" : providerConfigured ? "AI model connected" : "No AI model connected"}</span>{providerConfigured === false && <Button variant="plain" size="sm" onClick={() => window.location.assign(withAppBasePath("/manage/keys"))}>Connect</Button>}<Button variant="plain" size="icon" aria-label="More chat options" className="icon-button"><Icon name="more" size={19} /></Button></div></header>
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
        <div className="message-body">{message.role === "assistant" ? renderChatContent(message.text, message.toolFormats) : <p>{renderUserMessage(message.text, apps)}</p>}{message.role === "assistant" && <div className="message-tools"><Button variant="plain" size="icon" className="icon-button" aria-label="Copy response" onClick={async () => { await navigator.clipboard.writeText(message.text); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? <Icon name="check" size={20} /> : <Icon name="copy" size={20} />}</Button><Button variant="plain" size="icon" className="icon-button" aria-label="Good response"><Icon name="like" size={20} /></Button><Button variant="plain" size="icon" className="icon-button" aria-label="Bad response"><Icon name="dislike" size={20} /></Button></div>}</div>
      </article>)}{sending && <article className="message message-assistant"><span className="message-avatar"><Icon name="sparkles" size={20} /></span><div className="message-body" aria-live="polite" aria-atomic="true">
        {!requestProgress && <p className="request-status">Nia is thinking…</p>}
        {requestProgress?.type === "personalizing" && <p className="request-status">Please wait while I personalize results for you.</p>}
        {(requestProgress?.type === "connecting" || requestProgress?.type === "communicating") && <div className="app-request-status request-status"><span className="app-request-logo">{requestProgress.logo ? <img src={requestProgress.logo} alt="" /> : <Icon name="code" size={16} />}</span><span>{requestProgress.type === "connecting" ? "Connecting to" : "Communicating to"} <strong>{requestProgress.app}</strong></span></div>}
      </div></article>}{error && <div className="chat-error" role="alert"><p>{error}</p>{setupRequired && <Button variant="outlined" onClick={() => window.location.assign(withAppBasePath("/manage/keys"))}>Manage provider keys</Button>}</div>}</div>}
    </div>
    <div className="composer-wrap"><form className="composer" onSubmit={sendMessage}>
      {activeAppQuery && <div className="mention-suggestions" role="listbox" aria-label="Connected apps">{matchingApps.length ? matchingApps.map((app) => <button key={app.id} type="button" role="option" aria-selected="false" className="mention-suggestion" onMouseDown={(event) => event.preventDefault()} onClick={() => selectMentionedApp(app)}>{app.logo ? <img src={app.logo} alt="" /> : <Icon name="code" size={16} />}<span>@{app.name}</span></button>) : <div className="mention-empty">No matching connected apps.</div>}</div>}
      <Textarea ref={inputRef} value={draft} onChange={(event) => { const nextDraft = event.target.value; setDraftMentions((current) => updateMentionSpans(current, draft, nextDraft)); setDraft(nextDraft); setActiveAppQuery(findActiveAppQuery(nextDraft, event.target.selectionStart)); event.target.style.height = "auto"; event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`; }} onClick={(event) => setActiveAppQuery(findActiveAppQuery(event.currentTarget.value, event.currentTarget.selectionStart))} onKeyUp={(event) => setActiveAppQuery(findActiveAppQuery(event.currentTarget.value, event.currentTarget.selectionStart))} onKeyDown={(event) => { if (event.key === "Escape") setActiveAppQuery(null); if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Message Nia…" aria-label="Message Nia" rows={1} className="composer-input" />
      <div className="composer-footer"><div className="composer-tools"><Button type="button" variant="plain" size="icon" className="icon-button attach-button" aria-label="Attach a file"><Icon name="paperclip" size={17} /></Button><span className="composer-divider" /><span className="composer-hint">Nia can make mistakes. Check important info.</span></div><div className="composer-actions"><Button type="button" variant="plain" size="icon" className="icon-button voice-shortcut" aria-label="Open voice assistant" onClick={() => window.location.assign(withAppBasePath(chatId ? `/chat/${chatId}?mode=voice` : "/chat?mode=voice"))}><Icon name="voice" size={17} /></Button><Button type="submit" variant="solid" size="icon" className="send-button" aria-label="Send message" disabled={!draft.trim() || sending}><Icon name="send" size={17} /></Button></div></div>
    </form><div className="composer-caption">Nia · Personal assistant</div></div>
  </section>;
}

/** Selects voice mode or the regular chat view from the current chat URL. */
function ChatPageContent({ initialChatId, initialMessages, initialStatus, initialApps }: { initialChatId?: string; initialMessages?: Message[]; initialStatus?: string; initialApps?: ChatApp[] } = {}) {
  const searchParams = useSearchParams();
  if (searchParams.get("mode") === "voice") return <VoiceAssistant initialChatId={initialChatId} />;
  return <ChatConversationPage initialChatId={initialChatId} initialMessages={initialMessages} initialStatus={initialStatus} initialApps={initialApps} />;
}

/** Wraps search parameter consumers so static prerendering can suspend safely. */
export default function ChatPage(props: { initialChatId?: string; initialMessages?: Message[]; initialStatus?: string; initialApps?: ChatApp[] } = {}) {
  return <Suspense fallback={<section className="chat-page" aria-busy="true" />}><ChatPageContent {...props} /></Suspense>;
}
