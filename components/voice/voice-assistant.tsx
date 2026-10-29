"use client";
import { chatClientService } from "../../services/client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@neup/components/ui/button";
import { Icon } from "@/app/ui-icon";
import { VoiceOrb } from "./voice-orb";

type RecognitionResult = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> };
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: RecognitionResult) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

function getRequestStatus(request: string) {
  const parts = request.replace(/^--req\.?|--$/g, "").split(".").filter(Boolean);
  const app = parts[0] === "estate" ? "your estate app" : parts[0] === "personal" ? "your personal app" : "your connected apps";
  const items = parts.slice(1).map((item) => item.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()).join(", ") || "information";
  return `Nia is collecting ${items} from ${app} to respond to you.`;
}

export default function VoiceAssistant({ initialChatId }: { initialChatId?: number } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [requestStatus, setRequestStatus] = useState("");
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const [conversationReady, setConversationReady] = useState(!initialChatId);
  const recognition = useRef<Recognition | null>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const chatId = useRef<number | null>(null);
  const messages = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const transcriptRef = useRef("");
  const sendingRef = useRef(false);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionActive = useRef(false);
  const recognitionActive = useRef(false);
  const speakingRef = useRef(false);
  const userPeak = useRef(0);
  const capturedText = useRef("");

  useEffect(() => {
    if (!initialChatId) return;
    let cancelled = false;
    chatClientService.get(initialChatId).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load saved chat.");
      if (cancelled) return;
      chatId.current = result.id;
      messages.current = result.messages.map((message: { role: "user" | "assistant"; text: string }) => ({ role: message.role, content: message.text }));
      setReply([...result.messages].reverse().find((message: { role: string }) => message.role === "assistant")?.text ?? "");
      setConversationReady(true);
    }).catch((loadError) => {
      if (!cancelled) {
        setError(loadError instanceof Error ? loadError.message : "Could not load saved chat.");
        setConversationReady(true);
      }
    });
    return () => { cancelled = true; };
  }, [initialChatId]);

  function startRecognition() {
    if (!sessionActive.current || speakingRef.current || recognitionActive.current || !recognition.current) return;
    try { recognition.current.start(); recognitionActive.current = true; } catch { /* It may still be shutting down. */ }
  }

  useEffect(() => {
    const speech = window as SpeechWindow;
    const RecognitionConstructor = speech.SpeechRecognition ?? speech.webkitSpeechRecognition;
    if (!RecognitionConstructor) { setSupported(false); return; }
    const instance = new RecognitionConstructor();
    instance.lang = "en-US";
    instance.interimResults = true;
    instance.continuous = true;
    instance.onresult = (event) => {
      if (speakingRef.current) return;
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index][0];
        if (result.isFinal) capturedText.current += `${result.transcript} `;
        else interim += result.transcript;
      }
      const text = `${capturedText.current}${interim}`.trim();
      transcriptRef.current = text;
      setTranscript(text);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      if (text) silenceTimer.current = setTimeout(() => instance.stop(), 950);
    };
    instance.onend = () => {
      recognitionActive.current = false;
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      const text = (capturedText.current || transcriptRef.current).trim();
      capturedText.current = "";
      transcriptRef.current = "";
      if (text && sessionActive.current && !speakingRef.current) void respond(text);
      else if (sessionActive.current && !speakingRef.current) setTimeout(startRecognition, 180);
    };
    instance.onerror = () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      recognitionActive.current = false;
      if (sessionActive.current && !speakingRef.current) setTimeout(startRecognition, 500);
    };
    recognition.current = instance;
    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      sessionActive.current = false;
      instance.stop();
    };
  }, []);

  useEffect(() => {
    if (!listening || !navigator.mediaDevices?.getUserMedia || !orbRef.current) return;

    let active = true;
    let frame = 0;
    let stream: MediaStream | undefined;
    let audioContext: AudioContext | undefined;
    let smoothedLevel = 0;
    let previousLevel = 0;

    async function measureMicrophone() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        audioContext = new AudioContext();
        await audioContext.resume();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);

        const updateLevel = () => {
          if (!active || !orbRef.current) return;
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) {
            const value = (sample - 128) / 128;
            sum += value * value;
          }
          const loudness = Math.sqrt(sum / samples.length);
          smoothedLevel += (loudness > smoothedLevel ? 0.48 : 0.13) * (loudness - smoothedLevel);
          const intensity = Math.min(1, Math.max(0, (smoothedLevel - 0.008) * 5.5));
          if (speakingRef.current) {
            const interruptThreshold = Math.max(0.035, userPeak.current * 1.3);
            if (loudness > interruptThreshold) {
              window.speechSynthesis?.cancel();
              speakingRef.current = false;
              setSpeaking(false);
              startRecognition();
            }
          } else if (recognitionActive.current && loudness > 0.012) {
            userPeak.current = Math.max(userPeak.current * 0.995, loudness);
          }
          const change = Math.min(1, Math.abs(intensity - previousLevel) * 4.5);
          previousLevel = intensity;
          const time = performance.now() / 45;
          const shake = intensity * 4.5;
          orbRef.current.style.setProperty("--sound-scale", (1 + intensity * 0.3).toFixed(3));
          orbRef.current.style.setProperty("--shake-x", `${(Math.sin(time) * shake).toFixed(2)}px`);
          orbRef.current.style.setProperty("--shake-y", `${(Math.cos(time * 1.3) * shake).toFixed(2)}px`);
          orbRef.current.style.setProperty("--sound-glow", (0.08 + intensity * 0.2).toFixed(3));
          orbRef.current.style.setProperty("--ring-one-scale", (1 + intensity * 0.12).toFixed(3));
          orbRef.current.style.setProperty("--ring-two-scale", (1 + change * 0.2 + Math.sin(performance.now() / 850) * (0.025 + intensity * 0.035)).toFixed(3));
          orbRef.current.style.setProperty("--ring-two-opacity", (0.55 + change * 0.35 + intensity * 0.1).toFixed(3));
          frame = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch {
        // Speech recognition can still work in browsers that don't expose a separate audio meter.
      }
    }

    void measureMicrophone();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      if (audioContext && audioContext.state !== "closed") void audioContext.close();
      if (orbRef.current) {
        orbRef.current.style.removeProperty("--sound-scale");
        orbRef.current.style.removeProperty("--shake-x");
        orbRef.current.style.removeProperty("--shake-y");
        orbRef.current.style.removeProperty("--sound-glow");
        orbRef.current.style.removeProperty("--ring-one-scale");
        orbRef.current.style.removeProperty("--ring-two-scale");
        orbRef.current.style.removeProperty("--ring-two-opacity");
      }
    };
  }, [listening]);

  function toggleListening() {
    if (listening) {
      sessionActive.current = false;
      speakingRef.current = false;
      setSpeaking(false);
      window.speechSynthesis?.cancel();
      recognition.current?.stop();
      setListening(false);
      return;
    }
    sessionActive.current = true;
    capturedText.current = "";
    transcriptRef.current = "";
    setTranscript(""); setError("");
    setListening(true);
    startRecognition();
  }

  function startNewConversation() {
    if (listening || sending) return;
    chatId.current = null;
    messages.current = [];
    transcriptRef.current = "";
    capturedText.current = "";
    userPeak.current = 0;
    setTranscript("");
    setReply("");
    setError("");
  }

  async function respond(transcribedText: string) {
    const content = transcribedText.trim();
    if (!content || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setRequestStatus("");
    setError("");
    setReply("");
    try {
      const response = await chatClientService.send([...messages.current, { role: "user", content }], chatId.current ?? undefined);
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
          const event = JSON.parse(line) as { type: string; request?: string; result?: Record<string, unknown>; error?: string };
          if (event.type === "request" && event.request) setRequestStatus(getRequestStatus(event.request));
          else if (event.type === "final") result = event.result ?? null;
          else if (event.type === "error") throw new Error(event.error || "Nia couldn’t complete that request.");
        }
      }
      if (!result) throw new Error("Nia couldn’t complete that request.");
      chatId.current = result.chatId as number;
      const visibleReply = result.reply as string;
      const nextMessages = [...messages.current, { role: "user" as const, content }];
      messages.current = [...nextMessages, { role: "assistant", content: visibleReply }];
      setReply(visibleReply);
      window.dispatchEvent(new Event("chats-updated"));
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(visibleReply);
        speakingRef.current = true;
        setSpeaking(true);
        utterance.onend = () => {
          speakingRef.current = false;
          setSpeaking(false);
          if (sessionActive.current) setTimeout(startRecognition, 180);
        };
        utterance.onerror = () => {
          speakingRef.current = false;
          setSpeaking(false);
          if (sessionActive.current) setTimeout(startRecognition, 180);
        };
        if (sessionActive.current) window.speechSynthesis.speak(utterance);
        else { speakingRef.current = false; setSpeaking(false); }
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nia couldn’t complete that request.");
    } finally {
      setRequestStatus("");
      sendingRef.current = false;
      setSending(false);
      if (sessionActive.current && !speakingRef.current) setTimeout(startRecognition, 180);
    }
  }

  return <section className="flex min-h-0 flex-1 flex-col overflow-y-auto"><header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Voice assistant</strong></div><div className="flex items-center gap-[14px]"><Button variant="outlined" onClick={startNewConversation} disabled={listening || sending}>New conversation</Button><Button variant="plain" size="icon" aria-label="Voice settings" className="icon-button"><Icon name="settings" size={18} /></Button></div></header><div className="mx-auto flex w-[min(100%_-_40px,650px)] flex-1 flex-col items-center justify-center pt-[26px] pb-[38px] text-center"><div className="mb-[27px]"><div className="mb-[10px] flex items-center justify-center gap-[7px] text-xs font-bold tracking-[.1em] text-[#769079]"><Icon name="voice" size={15} /> NIA VOICE</div><h1 className="m-0 text-[clamp(35px,4vw,45px)] font-medium leading-[1.13] tracking-[-.055em] text-[#26332c]">Talk it out.</h1><p className="mt-[10px] text-[15px] text-[#88928a]">{initialChatId ? "Continue your saved conversation hands-free." : "Speak naturally. Nia is here to listen."}</p></div><VoiceOrb orbRef={orbRef} listening={listening} /><p className="mt-[6px] mb-[15px] min-h-5 text-[14px] text-[#7f8a81]" aria-live="polite">{requestStatus || (!conversationReady ? "Loading saved conversation…" : speaking ? "Nia is speaking — interrupt anytime" : listening ? sending ? "Nia is thinking…" : "Listening…" : supported ? "Ready when you are" : "Voice input isn’t supported in this browser")}</p><Button variant={listening ? "outlined" : "solid"} className="!h-[42px] !min-w-[168px] !rounded-[10px] !bg-[#52785e] !text-[14px]" onClick={toggleListening} disabled={!supported || !conversationReady}>{listening ? <><Icon name="micOff" size={17} /> End voice session</> : <><Icon name="mic" size={17} /> Start speaking</>}</Button>{transcript && <div className="mt-[21px] w-full max-w-[440px] rounded-xl border border-[#e5eae3] bg-white px-[17px] py-[15px] text-left"><span className="text-xs font-bold tracking-[.1em] text-[#7d8b7f]">I HEARD</span><p className="mt-[7px] mb-3 text-[15px] leading-[1.65] text-[#47534a]">{transcript}</p></div>}{error && <div className="chat-error" role="alert"><p>{error}</p></div>}{reply && <div className="mt-[21px] flex w-full max-w-[440px] items-start gap-[10px] rounded-xl border border-[#e5eae3] bg-white px-[17px] py-[15px] text-left"><span className="message-avatar"><Icon name="sparkles" size={14} /></span><p className="mt-[2px] mb-0 text-[14px] leading-[1.65] text-[#4d594f]">{reply}</p></div>}<p className="mt-[26px] text-[14px] text-[#89928b]">The orb grows and moves with your voice. Microphone audio stays in your browser.</p></div></section>;
}
