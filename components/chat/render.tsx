import type { ReactNode } from "react";
import { EstateBaseLead, type EstateLead } from "./estate.baselead";
import { EstateMyLeads } from "./estate.myleads";
import { EstateTeamLeads } from "./estate.teamleads";
import { ChatImages } from "./image";
import { EstateSavedProperty } from "./estate.savedproperty";

type BlockType = "base" | "mine" | "team" | "savedProperty" | "image";
type ChatBlock = { type: BlockType; content: string };

/** Splits supported neup fenced blocks from the surrounding assistant text. */
function splitChatBlocks(text: string): Array<string | ChatBlock> {
  const blocks: Array<string | ChatBlock> = [];
  const pattern = /```\s*neup\.(estate\.leads?\.(base|myleads|teamleads)|estate\.property\.saved|image)(?:[ \t]*\n|[ \t]+)?([\s\S]*?)```|(\{\s*['\"]?id['\"]?\s*:[\s\S]*?\})|(^|\n)\s*Property ID:\s*([^\s(]+)(?:\s*\(Saved on\s*([^)]+)\))?/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) blocks.push(text.slice(cursor, start));
    const isLooseLead = Boolean(match[4]);
    const isPlainSavedProperty = Boolean(match[6]);
    const type: BlockType = isPlainSavedProperty ? "savedProperty" : isLooseLead ? "base" : match[1] === "image" ? "image" : match[1] === "estate.property.saved" ? "savedProperty" : match[2] === "myleads" ? "mine" : match[2] === "teamleads" ? "team" : "base";
    const content = isPlainSavedProperty
      ? JSON.stringify({ propertyId: match[6], savedAt: match[7] ?? null })
      : isLooseLead ? match[4] : match[3];
    blocks.push({ type, content });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) blocks.push(text.slice(cursor));
  return blocks;
}

/** Parses the loose object syntax used in lead blocks. */
function parseLead(content: string): EstateLead | null {
  try {
    const parsed: unknown = JSON.parse(content.trim());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const lead = parsed as Record<string, unknown>;
      if ((typeof lead.id === "string" || typeof lead.id === "number") && typeof lead.name === "string") {
        return {
          id: lead.id,
          name: lead.name,
          lastTouch: typeof lead.lastTouch === "string" ? lead.lastTouch : null,
          image: typeof lead.image === "string" ? lead.image : null,
          remarks: typeof lead.remarks === "string" ? lead.remarks : null,
          email: typeof lead.email === "string" ? lead.email : null,
          phone: typeof lead.phone === "string" || typeof lead.phone === "number" ? String(lead.phone) : null,
        };
      }
    }
  } catch {
    // The model's documented format also allows the loose object form.
  }

  const fields = new Map<string, string>();
  const fieldPattern = /(?:^|[,{\n])\s*([\w]+)\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^,\n}]+)\s*,?/g;
  for (const match of content.matchAll(fieldPattern)) {
    const raw = match[2].trim();
    fields.set(match[1], raw === "null" ? "" : raw.startsWith('"') ? JSON.parse(raw) as string : raw.startsWith("'") ? raw.slice(1, -1) : raw);
  }
  const id = fields.get("id");
  const name = fields.get("name");
  if (!id || !name) return null;
  return { id, name, lastTouch: fields.get("lastTouch") || null, image: fields.get("image") || null, remarks: fields.get("remarks") || null, email: fields.get("email") || null, phone: fields.get("phone") || null };
}

/** Parses markdown image links from a neup.image block. */
function parseImages(content: string): string[] {
  const markdownUrls = Array.from(content.matchAll(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g), (match) => match[1]);
  const remaining = content.replace(/\[[^\]]*\]\(https?:\/\/[^\s)]+\)/g, "");
  const bracketedUrls = Array.from(remaining.matchAll(/\[(https?:\/\/[^\]]+)\]/g), (match) => match[1]);
  const plainText = remaining.replace(/\[https?:\/\/[^\]]+\]/g, "");
  return [...markdownUrls, ...bracketedUrls, ...Array.from(plainText.matchAll(/https?:\/\/[^\s\])}]+/g), (match) => match[0])];
}

/** Renders a recognized block or leaves malformed block content readable. */
function renderBlock(block: ChatBlock, key: number): ReactNode {
  if (block.type === "image") {
    const images = parseImages(block.content);
    return images.length ? <ChatImages key={key} images={images} /> : <p key={key}>{block.content}</p>;
  }
  if (block.type === "savedProperty") {
    try {
      const property: unknown = JSON.parse(block.content.trim());
      if (property && typeof property === "object" && !Array.isArray(property)) {
        return <EstateSavedProperty key={key} property={property as Record<string, unknown>} />;
      }
    } catch {
      // Keep malformed property blocks visible as text below.
    }
    return <p key={key}>{block.content}</p>;
  }
  const lead = parseLead(block.content);
  if (!lead) return <p key={key}>{block.content}</p>;
  if (block.type === "mine") return <EstateMyLeads key={key} leads={[lead]} />;
  if (block.type === "team") return <EstateTeamLeads key={key} leads={[lead]} />;
  return <EstateBaseLead key={key} lead={lead} />;
}

/** Renders chat text with supported estate lead and image blocks as UI elements. */
export function renderChatContent(text: string): ReactNode[] {
  return splitChatBlocks(text).map((part, index) => typeof part === "string"
    ? part.trim() ? <p key={index}>{part}</p> : null
    : renderBlock(part, index)).filter((part): part is ReactNode => part !== null);
}
