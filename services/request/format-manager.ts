import formats from "./format.json";

export type FormatRequest = "--format--";

/** Recognizes the command that asks Nia to load the supported chat block formats. */
export function isFormatRequest(reply: string): FormatRequest | null {
  return reply.trim() === "--format--" ? "--format--" : null;
}

/** Returns the block format keys and descriptions the model can use. */
export function collectFormats(): Record<string, string> {
  return formats;
}
