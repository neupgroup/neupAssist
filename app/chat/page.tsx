"use client";
import { chatClientService } from "../../services/client";
import { withAppBasePath } from "../../services/app-url";

import { FormEvent, Suspense, type ReactNode, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@neup/components/ui/button";
import { TextareaInput } from "@neup/components/ui/textarea.input";
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
    nodes.push(<span key={`app-mention-${index++}`} className="font-semibold text-primary">@{app?.name ?? match[1]}</span>);
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
            window.history.replaceState(null, "", withAppBasePath(`/chat/${event.chatId}`));
            window.dispatchEvent(new Event("chats-updated"));
          }
          else if (event.type === "final") result = event.result ?? null;
          else if (event.type === "error") { if (event.setupRequired) setSetupRequired(true); throw new Error(event.error || "Nia couldn’t complete that request."); }
        }
      }
      if (!result) throw new Error("Nia couldn’t complete that request.");
      setChatId(result.chatId as string);
      window.history.replaceState(null, "", withAppBasePath(`/chat/${result.chatId as string}`));
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

  return <section className="relative -mx-6 -mt-6 flex min-h-[calc(100dvh-4rem)] flex-col bg-white md:-mx-10 md:-mt-10">
    <div className="flex flex-1 flex-col">
      {messages.length === 0 ? <div className="mx-auto my-auto w-[min(calc(100%-40px),620px)] py-[30px] pb-12 text-center max-[600px]:w-[min(calc(100%-32px),500px)] max-[600px]:py-6 max-[600px]:pb-8">
        <h1 className="m-0 text-[clamp(35px,4vw,47px)] font-medium leading-[1.13] tracking-[-.055em] text-foreground">What can I help you<br className="hidden sm:block" /> with today?</h1><p className="mx-auto mt-[15px] max-w-[460px] text-base leading-[1.7] text-muted-foreground max-[600px]:max-w-[330px] max-[600px]:text-[15px]">Ask anything, think something through, or get a little help with your day.</p>
        <div className="mt-[35px] grid grid-cols-2 gap-[10px] text-left max-[600px]:mt-[25px] max-[600px]:gap-[7px]">
          <button className="group flex min-h-[68px] cursor-pointer items-center gap-[11px] rounded-xl border border-border bg-card px-[13px] py-[11px] text-left transition hover:-translate-y-px hover:border-primary-300 hover:shadow-md max-[600px]:min-h-16 max-[600px]:gap-2 max-[600px]:p-[9px]" onClick={() => setDraft("Help me plan a focused week")}><span className="grid h-[33px] w-[33px] shrink-0 place-items-center rounded-[10px] bg-success/10 text-success"><Icon name="calendar" size={17} /></span><span className="grid min-w-0 gap-1"><strong className="text-sm font-semibold text-card-foreground max-[600px]:text-[13px]">Plan my week</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-muted-foreground max-[600px]:text-xs">Make room for what matters</small></span><span className="ml-auto text-sm text-muted-foreground max-[600px]:hidden"><Icon name="arrow" size={16} /></span></button>
          <button className="group flex min-h-[68px] cursor-pointer items-center gap-[11px] rounded-xl border border-border bg-card px-[13px] py-[11px] text-left transition hover:-translate-y-px hover:border-primary-300 hover:shadow-md max-[600px]:min-h-16 max-[600px]:gap-2 max-[600px]:p-[9px]" onClick={() => setDraft("Help me think through a decision")}><span className="grid h-[33px] w-[33px] shrink-0 place-items-center rounded-[10px] bg-accent text-accent-foreground"><Icon name="brain" size={17} /></span><span className="grid min-w-0 gap-1"><strong className="text-sm font-semibold text-card-foreground max-[600px]:text-[13px]">Think it through</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-muted-foreground max-[600px]:text-xs">Talk through a decision</small></span><span className="ml-auto text-sm text-muted-foreground max-[600px]:hidden"><Icon name="arrow" size={16} /></span></button>
          <button className="group flex min-h-[68px] cursor-pointer items-center gap-[11px] rounded-xl border border-border bg-card px-[13px] py-[11px] text-left transition hover:-translate-y-px hover:border-primary-300 hover:shadow-md max-[600px]:min-h-16 max-[600px]:gap-2 max-[600px]:p-[9px]" onClick={() => setDraft("Explain a tricky topic simply")}><span className="grid h-[33px] w-[33px] shrink-0 place-items-center rounded-[10px] bg-warning/10 text-warning"><Icon name="bookOpen" size={17} /></span><span className="grid min-w-0 gap-1"><strong className="text-sm font-semibold text-card-foreground max-[600px]:text-[13px]">Learn something</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-muted-foreground max-[600px]:text-xs">Make a tricky topic simple</small></span><span className="ml-auto text-sm text-muted-foreground max-[600px]:hidden"><Icon name="arrow" size={16} /></span></button>
          <button className="group flex min-h-[68px] cursor-pointer items-center gap-[11px] rounded-xl border border-border bg-card px-[13px] py-[11px] text-left transition hover:-translate-y-px hover:border-primary-300 hover:shadow-md max-[600px]:min-h-16 max-[600px]:gap-2 max-[600px]:p-[9px]" onClick={() => setDraft("Help me write a thoughtful message")}><span className="grid h-[33px] w-[33px] shrink-0 place-items-center rounded-[10px] bg-informatic/10 text-informatic"><Icon name="pencil" size={17} /></span><span className="grid min-w-0 gap-1"><strong className="text-sm font-semibold text-card-foreground max-[600px]:text-[13px]">Write together</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-muted-foreground max-[600px]:text-xs">Find the right words</small></span><span className="ml-auto text-sm text-muted-foreground max-[600px]:hidden"><Icon name="arrow" size={16} /></span></button>
        </div>
      </div> : <div className="mx-auto my-[30px] mb-[45px] w-[min(calc(100%-52px),720px)] pb-[150px] max-[600px]:my-[22px] max-[600px]:w-[calc(100%-30px)]">{messages.map((message, index) => <article className={`my-[26px] flex gap-[13px] ${message.role === "user" ? "justify-end" : ""}`} key={`${index}-${message.role}`}>
        {message.role === "assistant" ? <span className="grid h-[27px] w-[27px] shrink-0 place-items-center rounded-[9px] border border-border bg-card text-primary-600"><Icon name="sparkles" size={20} /></span> : <span className="self-start pt-2 text-[13px] text-muted-foreground">You</span>}
        <div className={`min-w-0 ${message.role === "user" ? "max-w-[80%] rounded-[14px_14px_4px_14px] bg-muted px-[15px] py-3 text-foreground" : "max-w-[calc(100%-40px)] pt-[3px]"}`}><div className="[&>*+*]:mt-[10px] [&_p]:m-0 [&_p]:whitespace-pre-wrap [&_p]:text-[15px] [&_p]:leading-[1.75]">{message.role === "assistant" ? renderChatContent(message.text, message.toolFormats) : <p>{renderUserMessage(message.text, apps)}</p>}</div>{message.role === "assistant" && <div className="mt-[9px] flex gap-px"><Button variant="plain" size="icon" className="!h-[27px] !w-[27px]" aria-label="Copy response" onClick={async () => { await navigator.clipboard.writeText(message.text); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? <Icon name="check" size={20} /> : <Icon name="copy" size={20} />}</Button><Button variant="plain" size="icon" className="!h-[27px] !w-[27px]" aria-label="Good response"><Icon name="like" size={20} /></Button><Button variant="plain" size="icon" className="!h-[27px] !w-[27px]" aria-label="Bad response"><Icon name="dislike" size={20} /></Button></div>}</div>
      </article>)}{sending && <article className="my-[26px] flex gap-[13px]"><span className="grid h-[27px] w-[27px] shrink-0 place-items-center rounded-[9px] border border-border bg-card text-primary-600"><Icon name="sparkles" size={20} /></span><div className="min-w-0 pt-[3px]" aria-live="polite" aria-atomic="true">
        {!requestProgress && <p className="animate-pulse text-sm text-muted-foreground">Nia is thinking…</p>}
        {requestProgress?.type === "personalizing" && <p className="animate-pulse text-sm text-muted-foreground">Please wait while I personalize results for you.</p>}
        {(requestProgress?.type === "connecting" || requestProgress?.type === "communicating") && <div className="flex items-center gap-[9px] text-sm text-muted-foreground"><span className="grid h-[27px] w-[27px] shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-card text-primary-600">{requestProgress.logo ? <img className="h-full w-full object-cover" src={requestProgress.logo} alt="" /> : <Icon name="code" size={16} />}</span><span>{requestProgress.type === "connecting" ? "Connecting to" : "Communicating to"} <strong className="font-semibold text-foreground">{requestProgress.app}</strong></span></div>}
      </div></article>}{error && <div className="ml-10 mt-3 flex flex-wrap items-center gap-[10px] rounded-[10px] border border-danger/20 bg-danger/5 px-[14px] py-3 text-sm text-danger"><p className="m-0 leading-6">{error}</p>{setupRequired && <Button variant="outlined" onClick={() => window.location.assign(withAppBasePath("/settings/keys"))}>Manage provider keys</Button>}</div>}</div>}
    </div>
    <div className="fixed bottom-0 left-0 right-0 z-20 mx-auto w-[min(calc(100%-52px),730px)] bg-white pb-[17px] pt-3 max-[600px]:w-[calc(100%-28px)] max-[600px]:pb-[11px] lg:left-[calc(max(0px,(100vw-1440px)/2)+260px)] lg:right-[max(0px,calc((100vw-1440px)/2))]"><form className="relative rounded-[15px] border border-border bg-card px-3 pb-[9px] pt-[10px] shadow-[0_-8px_22px_rgb(20_30_22_/_5%)] transition focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary/10" onSubmit={sendMessage}>
      {activeAppQuery && <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-[5] max-h-[260px] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl" role="listbox" aria-label="Connected apps">{matchingApps.length ? matchingApps.map((app) => <button key={app.id} type="button" role="option" aria-selected="false" className="flex min-h-[42px] w-full cursor-pointer items-center gap-[10px] rounded-lg bg-transparent px-[10px] py-2 text-left text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none" onMouseDown={(event) => event.preventDefault()} onClick={() => selectMentionedApp(app)}>{app.logo ? <img className="h-[23px] w-[23px] rounded-md object-cover" src={app.logo} alt="" /> : <Icon name="code" size={16} />}<span>@{app.name}</span></button>) : <div className="px-[10px] py-3 text-[13px] text-muted-foreground">No matching connected apps.</div>}</div>}
      <div className="flex min-w-0 items-end gap-1">
        <Button type="button" variant="plain" size="icon" className="!h-[31px] !w-[31px] !shrink-0" aria-label="Attach a file"><Icon name="paperclip" size={17} /></Button>
        <TextareaInput ref={inputRef} autoGrow value={draft} onChange={(event) => { const nextDraft = event.target.value; setDraftMentions((current) => updateMentionSpans(current, draft, nextDraft)); setDraft(nextDraft); setActiveAppQuery(findActiveAppQuery(nextDraft, event.target.selectionStart)); event.target.style.height = "auto"; event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`; }} onClick={(event) => setActiveAppQuery(findActiveAppQuery(event.currentTarget.value, event.currentTarget.selectionStart))} onKeyUp={(event) => setActiveAppQuery(findActiveAppQuery(event.currentTarget.value, event.currentTarget.selectionStart))} onKeyDown={(event) => { if (event.key === "Escape") setActiveAppQuery(null); if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Message Nia…" aria-label="Message Nia" rows={1} className="block min-h-[39px] max-h-[180px] min-w-0 flex-1 resize-none overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-[7px] py-2 text-[15px] leading-[1.55] text-foreground placeholder:text-muted-foreground" />
        <Button type="button" variant="plain" size="icon" className="!h-[31px] !w-[31px] !shrink-0" aria-label="Open voice assistant" onClick={() => window.location.assign(withAppBasePath(chatId ? `/chat/${chatId}?mode=voice` : "/chat?mode=voice"))}><Icon name="voice" size={17} /></Button>
        <Button type="submit" variant="solid" size="icon" className="!h-[31px] !w-[31px] !shrink-0 !rounded-[9px] !bg-primary" aria-label="Send message" disabled={!draft.trim() || sending}><Icon name="send" size={17} /></Button>
      </div>
    </form><p className="mb-0 mt-2 text-center text-[13px] text-muted-foreground">Nia can make mistakes. Check important info.</p></div>
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
  return <Suspense fallback={<section className="flex min-h-0 flex-1 flex-col" aria-busy="true" />}><ChatPageContent {...props} /></Suspense>;
}
