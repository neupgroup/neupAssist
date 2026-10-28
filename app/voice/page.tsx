"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@neup/components/ui/button";
import { Icon } from "../ui-icon";

type RecognitionResult = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>> };
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: RecognitionResult) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export default function VoicePage() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const recognition = useRef<Recognition | null>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const chatId = useRef<number | null>(null);
  const messages = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const transcriptRef = useRef("");
  const sendingRef = useRef(false);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const speech = window as SpeechWindow;
    const RecognitionConstructor = speech.SpeechRecognition ?? speech.webkitSpeechRecognition;
    if (!RecognitionConstructor) { setSupported(false); return; }
    const instance = new RecognitionConstructor();
    instance.lang = "en-US";
    instance.interimResults = true;
    instance.continuous = true;
    instance.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join("").trim();
      transcriptRef.current = text;
      setTranscript(text);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      if (text) silenceTimer.current = setTimeout(() => instance.stop(), 1100);
    };
    instance.onend = () => {
      setListening(false);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      if (transcriptRef.current.trim()) void respond(transcriptRef.current);
    };
    instance.onerror = () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      setListening(false);
    };
    recognition.current = instance;
    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
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
    if (listening) { recognition.current?.stop(); setListening(false); return; }
    transcriptRef.current = "";
    messages.current = [];
    setTranscript(""); setReply(""); setError("");
    try { recognition.current?.start(); setListening(true); } catch { setListening(false); }
  }

  async function respond(transcribedText: string) {
    const content = transcribedText.trim();
    if (!content || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError("");
    setReply("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: chatId.current ?? undefined,
          messages: [...messages.current, { role: "user", content }],
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Nia couldn’t complete that request.");
      chatId.current = result.chatId;
      messages.current = [...messages.current, { role: "user", content }, { role: "assistant", content: result.reply }];
      setReply(result.reply);
      window.dispatchEvent(new Event("chats-updated"));
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(result.reply));
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nia couldn’t complete that request.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return <section className="voice-page"><header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Voice assistant</strong></div><Button variant="plain" size="icon" aria-label="Voice settings" className="icon-button"><Icon name="settings" size={18} /></Button></header><div className="voice-content"><div className="voice-heading"><div className="voice-kicker"><Icon name="voice" size={15} /> NIA VOICE</div><h1>Talk it out.</h1><p>Speak naturally. Nia is here to listen.</p></div><div ref={orbRef} className={`voice-orb ${listening ? "is-listening" : ""}`}><div className="orb-ring ring-one" /><div className="orb-ring ring-two" /><div className="orb-core"><Icon name="sparkles" size={30} strokeWidth={1.5} /></div><div className="voice-wave"><i /><i /><i /><i /><i /><i /><i /></div></div><p className="voice-state">{listening ? "Listening…" : sending ? "Nia is thinking…" : supported ? "Ready when you are" : "Voice input isn’t supported in this browser"}</p><Button variant={listening ? "outlined" : "solid"} className="voice-toggle" onClick={toggleListening} disabled={!supported || sending}>{listening ? <><Icon name="micOff" size={17} /> Stop listening</> : <><Icon name="mic" size={17} /> Start speaking</>}</Button>{transcript && <div className="transcript-card"><span className="transcript-label">I HEARD</span><p>{transcript}</p></div>}{error && <div className="chat-error" role="alert"><p>{error}</p></div>}{reply && <div className="voice-reply"><span className="message-avatar"><Icon name="sparkles" size={14} /></span><p>{reply}</p></div>}<p className="voice-footnote">The orb grows and moves with your voice. Microphone audio stays in your browser.</p></div></section>;
}
