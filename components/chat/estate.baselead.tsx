"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type EstateLead = {
  id: string | number;
  name: string;
  lastTouch?: string | null;
  image?: string | null;
  remarks?: string | null;
  email?: string | null;
  phone?: string | null;
};

/** Builds a WhatsApp URL from an international number or a ten-digit Nepal number. */
function getWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const internationalDigits = phone.trim().startsWith("+") ? digits : digits.length === 10 ? `977${digits}` : digits;
  return `https://wa.me/${internationalDigits}`;
}

/** Renders one estate lead as a compact chat card. */
export function EstateBaseLead({ lead }: { lead: EstateLead }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    /** Closes the lead contact dialog when the user presses Escape. */
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return <>
    <button type="button" className="mb-3 flex w-full max-w-[460px] cursor-pointer items-start gap-3 rounded-xl border border-[#e6ebe4] bg-white p-3 text-left text-inherit transition-[border-color,box-shadow] hover:border-[#cbd8ca] hover:shadow-[0_4px_14px_#293a2d0b] focus-visible:border-[#cbd8ca] focus-visible:shadow-[0_4px_14px_#293a2d0b] focus-visible:outline-none" onClick={() => setIsOpen(true)} aria-haspopup="dialog" aria-label={`Open contact options for ${lead.name}`}>
      {lead.image ? <Image className="h-12 w-12 shrink-0 rounded-[10px] object-cover" src={lead.image} alt="" width={48} height={48} unoptimized /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] bg-[#edf3ec] text-[18px] font-semibold text-[#5d7c63]" aria-hidden="true">{lead.name.trim().slice(0, 1).toUpperCase() || "L"}</span>}
      <span className="grid min-w-0 gap-px">
        <strong className="text-[15px] font-semibold text-[#435046]">{lead.name}</strong>
        {lead.lastTouch && <span className="text-[14px] leading-[1.4] text-[#858f86]">Last touch {lead.lastTouch}</span>}
        {(lead.email || lead.phone) && <span className="text-[14px] leading-[1.4] text-[#858f86]">{[lead.email, lead.phone].filter(Boolean).join(" · ")}</span>}
        {lead.remarks && <span className="mt-[2px] text-[14px] leading-[1.5] text-[#67736a]">{lead.remarks}</span>}
      </span>
    </button>
    {isOpen && <div className="fixed inset-0 z-[30] grid place-items-center bg-[rgb(24_34_27_/_38%)] p-5" onClick={() => setIsOpen(false)}>
      <section className="relative w-full max-w-[420px] rounded-2xl border border-[#e5ebe3] bg-white p-[23px] shadow-[0_20px_70px_rgb(23_36_27_/_22%)]" role="dialog" aria-modal="true" aria-labelledby={`estate-lead-title-${lead.id}`} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="absolute right-3 top-[10px] grid h-8 w-8 cursor-pointer place-items-center rounded-lg bg-transparent text-2xl text-[#778178] hover:bg-[#f2f5f1]" onClick={() => setIsOpen(false)} aria-label="Close contact options">×</button>
        <div className="flex items-center gap-3 pr-6">
          {lead.image ? <Image className="h-12 w-12 shrink-0 rounded-[10px] object-cover" src={lead.image} alt="" width={48} height={48} unoptimized /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] bg-[#edf3ec] text-[18px] font-semibold text-[#5d7c63]" aria-hidden="true">{lead.name.trim().slice(0, 1).toUpperCase() || "L"}</span>}
          <div><h2 className="m-0 text-[15px] font-semibold text-[#3c4940]" id={`estate-lead-title-${lead.id}`}>{lead.name}</h2><p className="mt-1 text-[14px] text-[#879188]">Contact this lead</p></div>
        </div>
        <div className="mt-[21px] grid gap-2">
          {lead.phone && <a className="grid gap-[3px] rounded-[9px] border border-[#e8ede6] px-3 py-[11px] text-[15px] font-semibold text-[#526e57] transition-colors hover:bg-[#f6f9f5]" href={`tel:${lead.phone}`}>Call<span className="text-[14px] font-normal text-[#879188]">{lead.phone}</span></a>}
          {lead.email && <a className="grid gap-[3px] rounded-[9px] border border-[#e8ede6] px-3 py-[11px] text-[15px] font-semibold text-[#526e57] transition-colors hover:bg-[#f6f9f5]" href={`mailto:${lead.email}`}>Send email<span className="text-[14px] font-normal text-[#879188]">{lead.email}</span></a>}
          {lead.phone && <a className="grid gap-[3px] rounded-[9px] border border-[#e8ede6] px-3 py-[11px] text-[15px] font-semibold text-[#526e57] transition-colors hover:bg-[#f6f9f5]" href={getWhatsAppUrl(lead.phone)} target="_blank" rel="noreferrer">Message on WhatsApp<span className="text-[14px] font-normal text-[#879188]">{lead.phone}</span></a>}
          {!lead.phone && !lead.email && <p className="m-0 p-3 text-[14px] leading-[1.55] text-[#7e8980]">No phone number or email is available for this lead.</p>}
        </div>
      </section>
    </div>}
  </>;
}
