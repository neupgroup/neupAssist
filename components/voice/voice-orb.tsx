"use client";

import type { RefObject } from "react";
import { Icon } from "@/app/ui-icon";

/** Renders the voice-reactive orb and keeps its visual styles beside its markup. */
export function VoiceOrb({ orbRef, listening }: { orbRef: RefObject<HTMLDivElement | null>; listening: boolean }) {
  return <>
    <div ref={orbRef} className={`orb ${listening ? "is-listening" : ""}`}>
      <div className="ring ring-one" />
      <div className="ring ring-two" />
      <div className="core"><Icon name="sparkles" size={30} strokeWidth={1.5} /></div>
      <div className="wave"><i /><i /><i /><i /><i /><i /><i /></div>
    </div>
    <style jsx>{`
      .orb { position: relative; display: grid; width: 222px; height: 222px; place-items: center; margin: 4px 0 15px; }
      .ring { position: absolute; border: 1px solid #dfe8df; border-radius: 50%; transition: all .5s ease; }
      .ring-one { inset: 19px; transform: scale(var(--ring-one-scale, 1)); transform-origin: center; will-change: transform; }
      .ring-two { inset: 0; transform: scale(var(--ring-two-scale, 1)); transform-origin: center; border-color: #e8eee7; opacity: var(--ring-two-opacity, 1); will-change: transform, opacity; }
      .core { position: relative; z-index: 1; display: grid; width: 115px; height: 115px; place-items: center; transform: translate(var(--shake-x, 0px), var(--shake-y, 0px)) scale(var(--sound-scale, 1)); border: 1px solid #e2e9e0; border-radius: 50%; background: radial-gradient(circle at 36% 30%, #fff 0, #f7faf6 50%, #e7efe6 100%); color: #65856b; box-shadow: 0 12px 38px rgb(74 107 74 / var(--sound-glow, .08)), inset 0 2px 5px #fff; will-change: transform; }
      .wave { position: absolute; z-index: 2; bottom: 38px; left: 50%; display: flex; height: 22px; align-items: center; gap: 3px; transform: translateX(-50%); opacity: 0; transition: opacity .2s; }
      .wave i { display: block; width: 2px; height: 7px; border-radius: 3px; background: #78967c; }
      .wave i:nth-child(2), .wave i:nth-child(6) { height: 12px; }
      .wave i:nth-child(3), .wave i:nth-child(5) { height: 17px; }
      .wave i:nth-child(4) { height: 22px; }
      .is-listening .ring-one { inset: 10px; border-color: #c5d9c6; animation: ring-breathe 2.8s ease-in-out infinite; }
      .is-listening .ring-two { inset: -8px; border-color: #d9e7d9; }
      .is-listening .core { background: radial-gradient(circle at 36% 30%, #fff 0, #edf5ec 55%, #d7e7d7 100%); }
      .is-listening .wave { opacity: 1; }
      @keyframes ring-breathe { 50% { opacity: .48; } }
      @media (prefers-reduced-motion: reduce) { .ring, .wave { transition: none; } .is-listening .ring-one { animation: none; } }
    `}</style>
  </>;
}
