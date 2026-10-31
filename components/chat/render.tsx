import type { ReactNode } from "react";
import { EstateBaseLead, type EstateLead } from "./estate.baselead";
import { EstateMyLeads } from "./estate.myleads";
import { EstateTeamLeads } from "./estate.teamleads";
import { ChatImages } from "./image";
import { EstateSavedProperty } from "./estate.savedproperty";
import { EstateActivityConfirmation, type EstateActivity } from "./estate.activity-confirmation";

type BlockType = "base" | "mine" | "team" | "savedProperty" | "activityConfirmation" | "image";
type ChatBlock = { type: BlockType; content: string };
type ToolFormatHint = { format: string };

/** Renders explicit Nia link tags and markdown links as safe actionable anchors. */
function renderTextWithLinks(text: string): ReactNode[] {
  const pattern = /<nia\.link\.(tel|email)>([\s\S]*?)<\/nia\.link\.\1>|\[([^\]]+)\]\(((?:https?:\/\/|tel:|mailto:)[^)\s]+)\)|(https?:\/\/[^\s<>]+)/gi;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    if (match[1] && match[2]) {
      const value = match[2].trim();
      const phone = value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
      const href = match[1].toLowerCase() === "tel" ? `tel:${phone}` : `mailto:${value}`;
      nodes.push(<a key={key++} href={href}>{value}</a>);
    } else if (match[4]) {
      const external = /^https?:\/\//i.test(match[4]);
      nodes.push(<a key={key++} href={match[4]} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{match[3]}</a>);
    } else {
      const url = match[5].replace(/[.,!?;:)}\]]+$/, "");
      const trailing = match[5].slice(url.length);
      nodes.push(<a key={key++} href={url} target="_blank" rel="noreferrer">{url}</a>, trailing);
    }
    cursor = start + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/** Renders common inline Markdown while preserving safe link handling. */
function renderMarkdownInline(text: string): ReactNode[] {
  text = text.replace(/\\([*_`])/g, "$1");
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*\n]+\*(?!\*)|(?<!_)_[^_\n]+_(?!_))/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(...renderTextWithLinks(text.slice(cursor, start)));
    const token = match[0];
    const isDouble = token.startsWith("**") || token.startsWith("__");
    const content = token.slice(isDouble ? 2 : 1, isDouble ? -2 : -1);
    const key = `markdown-inline-${index++}`;
    if (token.startsWith("`")) nodes.push(<code key={key} className="markdown-inline-code">{content}</code>);
    else if (isDouble) nodes.push(<strong key={key}>{renderTextWithLinks(content)}</strong>);
    else nodes.push(<em key={key}>{renderTextWithLinks(content)}</em>);
    cursor = start + token.length;
  }
  if (cursor < text.length) nodes.push(...renderTextWithLinks(text.slice(cursor)));
  return nodes;
}

/** Renders Nia's explicit content tags as semantic chat elements. */
function renderNiaTags(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /<nia\.(h1|h2|h3|code|image|imageUpload|fileUpload|filesUpload|table|list)>([\s\S]*?)<\/nia\.\1>/gi;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(...renderMarkdownTables(text.slice(cursor, start), `${keyPrefix}-plain-${index}`));
    const tag = match[1].toLowerCase();
    const content = match[2].trim();
    const key = `${keyPrefix}-${index++}`;
    if (tag === "h1" || tag === "h2" || tag === "h3") {
      const Tag = tag;
      nodes.push(<Tag key={key}>{renderMarkdownInline(content)}</Tag>);
    } else if (tag === "code") {
      nodes.push(<pre key={key} className="nia-code"><code>{content}</code></pre>);
    } else if (tag === "image" || tag === "imageupload") {
      const images = parseImages(content);
      const urls = images.length ? images : /^https?:\/\//i.test(content) ? [content] : [];
      nodes.push(urls.length ? <ChatImages key={key} images={urls} /> : <p key={key}>{content}</p>);
    } else if (tag === "fileupload" || tag === "filesupload") {
      const files = content.split(/\r?\n/).map((file) => file.trim()).filter(Boolean);
      nodes.push(<ul key={key} className="nia-files">{files.map((file) => <li key={file}>{/^https?:\/\//i.test(file) ? <a href={file} target="_blank" rel="noreferrer">{file}</a> : file}</li>)}</ul>);
    } else if (tag === "list") {
      const items = content.split(/\r?\n/).map((item) => item.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean);
      nodes.push(<ul key={key} className="nia-list">{items.map((item, itemIndex) => <li key={itemIndex}>{renderTextWithLinks(item)}</li>)}</ul>);
    } else if (tag === "table") {
      nodes.push(renderNiaTable(content, key));
    }
    cursor = start + match[0].length;
  }
  if (cursor < text.length) nodes.push(...renderMarkdownTables(text.slice(cursor), `${keyPrefix}-plain-${index}`));
  return nodes;
}

/** Splits one Markdown table row while respecting escaped pipes and inline code. */
function splitMarkdownTableRow(row: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inCode = false;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === "\\" && row[index + 1] === "|") {
      cell += "|";
      index += 1;
    } else if (character === "`") {
      inCode = !inCode;
      cell += character;
    } else if (character === "|" && !inCode) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  if (row.trimStart().startsWith("|")) cells.shift();
  if (row.trimEnd().endsWith("|") && cells.length) cells.pop();
  return cells;
}

/** Parses standard Markdown table alignment markers. */
function parseMarkdownTableAlignment(row: string): Array<"left" | "center" | "right"> | null {
  const cells = splitMarkdownTableRow(row);
  if (!cells.length || cells.some((cell) => !/^:?-{3,}:?$/.test(cell))) return null;
  return cells.map((cell) => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : "left");
}

/** Renders rows and per-column alignment in the shared responsive table view. */
function renderTableRows(rows: string[][], alignment: Array<"left" | "center" | "right">, key: string): ReactNode {
  if (!rows.length) return null;
  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? ""));
  return <div key={key} className="nia-table-wrap"><table className="nia-table"><thead><tr>{normalizedRows[0].map((cell, cellIndex) => <th key={cellIndex} style={{ textAlign: alignment[cellIndex] ?? "left" }}>{renderMarkdownInline(cell)}</th>)}</tr></thead><tbody>{normalizedRows.slice(1).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ textAlign: alignment[cellIndex] ?? "left" }}>{renderMarkdownInline(cell)}</td>)}</tr>)}</tbody></table></div>;
}

/** Renders Markdown pipe tables while preserving the text around each table. */
function renderMarkdownTables(text: string, keyPrefix: string): ReactNode[] {
  const lines = text.split(/(?<=\n)/);
  const nodes: ReactNode[] = [];
  let plain = "";
  let index = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const header = lines[lineIndex].replace(/\r?\n$/, "");
    const separator = lines[lineIndex + 1]?.replace(/\r?\n$/, "");
    const alignment = header.includes("|") && separator ? parseMarkdownTableAlignment(separator) : null;
    if (!alignment) {
      plain += lines[lineIndex];
      continue;
    }
    if (plain) {
      if (plain.trim()) nodes.push(...renderMarkdownText(plain, `${keyPrefix}-text-${index++}`));
      plain = "";
    }
    const rows = [splitMarkdownTableRow(header)];
    lineIndex += 1;
    while (lineIndex + 1 < lines.length) {
      const next = lines[lineIndex + 1].replace(/\r?\n$/, "");
      if (!next.includes("|")) break;
      rows.push(splitMarkdownTableRow(next));
      lineIndex += 1;
    }
    nodes.push(renderTableRows(rows, alignment, `${keyPrefix}-table-${index++}`));
  }
  if (plain.trim()) nodes.push(...renderMarkdownText(plain, `${keyPrefix}-text-${index}`));
  return nodes;
}

/** Converts Markdown paragraphs and lists into readable chat elements. */
function renderMarkdownText(text: string, keyPrefix: string): ReactNode[] {
  const normalizedText = text.replace(/\\([*_`#])/g, "$1");
  const lines = normalizedText.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let index = 0;
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    const key = `${keyPrefix}-${index++}`;
    nodes.push(<p key={key}>{paragraph.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{renderMarkdownInline(line)}</span>)}</p>);
    paragraph = [];
  };

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      flushParagraph();
      index += 1;
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flushParagraph();
      const level = Math.min(3, heading[1].length);
      const Heading = `h${level}` as "h1" | "h2" | "h3";
      nodes.push(<Heading key={`${keyPrefix}-${index++}`}>{renderMarkdownInline(heading[2])}</Heading>);
      continue;
    }

    const listMatch = line.match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      const ordered = /^\d/.test(listMatch[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push(item[2]);
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      nodes.push(<List key={`${keyPrefix}-${index++}`} className="markdown-list">{items.map((item, itemIndex) => <li key={itemIndex}>{renderMarkdownInline(item)}</li>)}</List>);
      continue;
    }

    paragraph.push(line);
    index += 1;
  }

  flushParagraph();
  return nodes;
}

/** Renders a nia.table payload from JSON rows or tab-separated text. */
function renderNiaTable(content: string, key: string): ReactNode {
  let rows: string[][] = [];
  try {
    const parsed: unknown = JSON.parse(content);
    if (Array.isArray(parsed)) rows = parsed.map((row) => Array.isArray(row) ? row.map((cell) => cell == null ? "" : String(cell)) : row && typeof row === "object" ? Object.values(row as Record<string, unknown>).map((cell) => cell == null ? "" : String(cell)) : [row == null ? "" : String(row)]);
  } catch {
    rows = content.split(/\r?\n/).filter(Boolean).map((row) => row.includes("|") ? splitMarkdownTableRow(row) : row.split("\t").map((cell) => cell.trim()));
  }
  if (!rows.length) return <p key={key}>{content}</p>;
  return renderTableRows(rows, rows[0].map(() => "left"), key);
}

/** Splits supported nia fenced blocks from the surrounding assistant text. */
function splitChatBlocks(text: string, toolFormats: ToolFormatHint[] = []): Array<string | ChatBlock> {
  const blocks: Array<string | ChatBlock> = [];
  const declaredFormats = toolFormats.length
    ? new Set(toolFormats.flatMap(({ format }) => Array.from(format.matchAll(/```(nia\.[a-zA-Z0-9_.-]+)/g), (match) => match[1])))
    : null;
  const pattern = /```\s*nia\.(estate\.leads?\.(base|myleads|teamleads)|estate\.property\.saved|estate\.activity\.confirmation|image)(?:[ \t]*\n|[ \t]+)?([\s\S]*?)```|(\{\s*['\"]?id['\"]?\s*:[\s\S]*?\})|(^|\n)\s*Property ID:\s*([^\s(]+)(?:\s*\(Saved on\s*([^)]+)\))?/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    const formatName = match[1] ? `nia.${match[1]}` : null;
    if (declaredFormats && formatName && !declaredFormats.has(formatName)) continue;
    if (start > cursor) blocks.push(text.slice(cursor, start));
    const isLooseLead = Boolean(match[4]);
    const isPlainSavedProperty = Boolean(match[6]);
    const type: BlockType = isPlainSavedProperty ? "savedProperty" : isLooseLead ? "base" : match[1] === "image" ? "image" : match[1] === "estate.property.saved" ? "savedProperty" : match[1] === "estate.activity.confirmation" ? "activityConfirmation" : match[2] === "myleads" ? "mine" : match[2] === "teamleads" ? "team" : "base";
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

/** Parses markdown image links from an nia.image block. */
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
  if (block.type === "activityConfirmation") {
    try {
      const activity: unknown = JSON.parse(block.content.trim());
      if (activity && typeof activity === "object" && !Array.isArray(activity)) {
        const record = activity as Record<string, unknown>;
        if (typeof record.activityType === "string" && typeof record.remarks === "string") {
          const confirmation: EstateActivity = {
            leadName: typeof record.leadName === "string" ? record.leadName : null,
            activityType: record.activityType,
            remarks: record.remarks,
            activityOn: typeof record.activityOn === "string" ? record.activityOn : null,
            followUpMethod: typeof record.followUpMethod === "string" ? record.followUpMethod : null,
          };
          return <EstateActivityConfirmation key={key} activity={confirmation} />;
        }
      }
    } catch {
      // Keep malformed confirmation data visible as text below.
    }
    return <p key={key}>{block.content}</p>;
  }
  const lead = parseLead(block.content);
  if (!lead) return <p key={key}>{block.content}</p>;
  if (block.type === "mine") return <EstateMyLeads key={key} leads={[lead]} />;
  if (block.type === "team") return <EstateTeamLeads key={key} leads={[lead]} />;
  return <EstateBaseLead key={key} lead={lead} />;
}

/** Renders chat text with explicit links and supported estate, activity, and image blocks. */
export function renderChatContent(text: string, toolFormats: ToolFormatHint[] = []): ReactNode[] {
  return splitChatBlocks(text, toolFormats).map((part, index) => typeof part === "string"
    ? part.trim() ? <div key={index} className="chat-rich-text">{renderNiaTags(part, `text-${index}`)}</div> : null
    : renderBlock(part, index)).filter((part): part is ReactNode => part !== null);
}
