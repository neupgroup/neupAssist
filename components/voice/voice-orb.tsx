"use client";

import type { RefObject } from "react";
import { Icon } from "@/app/ui-icon";

/** Renders the voice-reactive orb and keeps its visual styles beside its markup. */
export function VoiceOrb({ orbRef, listening }: { orbRef: RefObject<HTMLDivElement | null>; listening: boolean }) {
  return <>
    <div ref={orbRef} className="relative my-[4px] mb-[15px] grid h-[222px] w-[222px] place-items-center">
      <div className={`absolute rounded-full border transition-all duration-500 motion-reduce:transition-none ${listening ? "inset-[10px] border-primary-300 motion-safe:animate-ring-breathe motion-reduce:animate-none" : "inset-[19px] border-primary-200"}`} style={{ transform: "scale(var(--ring-one-scale, 1))", transformOrigin: "center", willChange: "transform" }} />
      <div className={`absolute rounded-full border transition-all duration-500 motion-reduce:transition-none ${listening ? "-inset-2 border-primary-200" : "inset-0 border-primary-100"}`} style={{ transform: "scale(var(--ring-two-scale, 1))", transformOrigin: "center", opacity: "var(--ring-two-opacity, 1)", willChange: "transform, opacity" }} />
      <div className={`relative z-[1] grid h-[115px] w-[115px] place-items-center rounded-full border border-primary-200 text-primary-600 [background:radial-gradient(circle_at_36%_30%,white_0,var(--primary-50)_50%,var(--primary-100)_100%)] [box-shadow:0_12px_38px_rgb(74_107_74_/_var(--sound-glow,.08)),inset_0_2px_5px_white] [transform:translate(var(--shake-x,0px),var(--shake-y,0px))_scale(var(--sound-scale,1))] ${listening ? "[background:radial-gradient(circle_at_36%_30%,white_0,var(--primary-50)_55%,var(--primary-200)_100%)]" : ""}`} style={{ willChange: "transform" }}><Icon name="sparkles" size={30} strokeWidth={1.5} /></div>
      <div className={`absolute bottom-[38px] left-1/2 z-[2] flex h-[22px] -translate-x-1/2 items-center gap-[3px] transition-opacity duration-200 motion-reduce:transition-none ${listening ? "opacity-100" : "opacity-0"}`} aria-hidden="true">{["h-[7px]", "h-3", "h-[17px]", "h-[22px]", "h-[17px]", "h-3", "h-[7px]"].map((height, index) => <span key={index} className={`block w-[2px] rounded-full bg-primary-400 ${height}`} />)}</div>
    </div>
  </>;
}
