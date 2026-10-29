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
    <button type="button" className="estate-lead-card" onClick={() => setIsOpen(true)} aria-haspopup="dialog" aria-label={`Open contact options for ${lead.name}`}>
      {lead.image ? <Image className="estate-lead-image" src={lead.image} alt="" width={48} height={48} unoptimized /> : <span className="estate-lead-placeholder" aria-hidden="true">{lead.name.trim().slice(0, 1).toUpperCase() || "L"}</span>}
      <span className="estate-lead-content">
        <strong>{lead.name}</strong>
        {lead.lastTouch && <span className="estate-lead-meta">Last touch {lead.lastTouch}</span>}
        {(lead.email || lead.phone) && <span className="estate-lead-meta">{[lead.email, lead.phone].filter(Boolean).join(" · ")}</span>}
        {lead.remarks && <span className="estate-lead-remarks">{lead.remarks}</span>}
      </span>
    </button>
    {isOpen && <div className="estate-lead-dialog-backdrop" onClick={() => setIsOpen(false)}>
      <section className="estate-lead-dialog" role="dialog" aria-modal="true" aria-labelledby={`estate-lead-title-${lead.id}`} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="estate-lead-dialog-close" onClick={() => setIsOpen(false)} aria-label="Close contact options">×</button>
        <div className="estate-lead-dialog-heading">
          {lead.image ? <Image className="estate-lead-image" src={lead.image} alt="" width={48} height={48} unoptimized /> : <span className="estate-lead-placeholder" aria-hidden="true">{lead.name.trim().slice(0, 1).toUpperCase() || "L"}</span>}
          <div><h2 id={`estate-lead-title-${lead.id}`}>{lead.name}</h2><p>Contact this lead</p></div>
        </div>
        <div className="estate-lead-actions">
          {lead.phone && <a className="estate-lead-action" href={`tel:${lead.phone}`}>Call<span>{lead.phone}</span></a>}
          {lead.email && <a className="estate-lead-action" href={`mailto:${lead.email}`}>Send email<span>{lead.email}</span></a>}
          {lead.phone && <a className="estate-lead-action" href={getWhatsAppUrl(lead.phone)} target="_blank" rel="noreferrer">Message on WhatsApp<span>{lead.phone}</span></a>}
          {!lead.phone && !lead.email && <p className="estate-lead-no-contact">No phone number or email is available for this lead.</p>}
        </div>
      </section>
    </div>}
  </>;
}
