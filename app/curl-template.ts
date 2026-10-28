export const RESPONSE_FORMAT_SEPARATOR = "\n---response---\n";

function tokenizeCurl(command: string) {
  const tokens: string[] = [];
  let token = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (const char of command.trim()) {
    if (escaped) {
      // In shell cURL snippets, backslash-newline joins the following line.
      if (char !== "\n" && char !== "\r") token += char;
      escaped = false;
    } else if (char === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (char === quote) quote = null;
      else token += char;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (/\s/.test(char)) {
      if (token) tokens.push(token);
      token = "";
    } else {
      token += char;
    }
  }
  if (escaped || quote) throw new Error("The cURL template has an unfinished quote or escape.");
  if (token) tokens.push(token);
  return tokens;
}

export function renderCurlTemplate(template: string, values: { model: string; provider: string; input: string; apikey: string }) {
  const tokens = tokenizeCurl(template).map((token) => token
    .replaceAll("{{modelcode}}", values.model)
    .replaceAll("{{model}}", values.model)
    .replaceAll("{{provider}}", values.provider)
    .replaceAll("{{input}}", values.input)
    .replaceAll("{{apikey}}", values.apikey));
  if (tokens[0]?.toLowerCase() === "curl") tokens.shift();
  let url = "";
  let method = "GET";
  let data: string | undefined;
  const headers = new Headers();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const takeValue = (option: string) => {
      const value = tokens[++i];
      if (value === undefined) throw new Error(`The cURL option ${option} needs a value.`);
      return value;
    };
    if (["-s", "-S", "-sS", "-L", "--silent", "--show-error", "--location", "--compressed", "--fail"].includes(token)) continue;
    if (token === "-X" || token === "--request") method = takeValue(token).toUpperCase();
    else if (token === "-H" || token === "--header") {
      const header = takeValue(token);
      const separator = header.indexOf(":");
      if (separator < 1) throw new Error("cURL headers must use the format Name: value.");
      headers.set(header.slice(0, separator).trim(), header.slice(separator + 1).trim());
    } else if (["-d", "--data", "--data-raw", "--data-binary"].includes(token)) {
      data = takeValue(token);
      if (method === "GET") method = "POST";
    } else if (token === "--url") url = takeValue(token);
    else if (token.startsWith("-")) throw new Error(`Unsupported cURL option: ${token}`);
    else if (!url) url = token;
    else throw new Error("The cURL template includes an unsupported positional argument.");
  }

  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("cURL request URL must use HTTP or HTTPS.");
  return { url: parsedUrl.toString(), method, headers, body: data };
}

export function extractOutputByFormat(responseText: string, format: string) {
  const marker = "__NIA_OUTPUT_VALUE__";
  const markedFormat = format
    .replaceAll('"{{output}}"', JSON.stringify(marker))
    .replaceAll("{{output}}", JSON.stringify(marker));
  let normalizedFormat = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < markedFormat.length; i++) {
    const char = markedFormat[i];
    if (inString) {
      normalizedFormat += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      normalizedFormat += char;
    } else if (char === ",") {
      let next = i + 1;
      while (/\s/.test(markedFormat[next] ?? "")) next++;
      if (markedFormat[next] !== "}" && markedFormat[next] !== "]") normalizedFormat += char;
    } else {
      normalizedFormat += char;
    }
  }
  const template = JSON.parse(normalizedFormat) as unknown;
  const response = JSON.parse(responseText) as unknown;
  const findMarker = (value: unknown, path: (string | number)[] = []): (string | number)[] | null => {
    if (value === marker) return path;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const found = findMarker(value[i], [...path, i]);
        if (found) return found;
      }
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        const found = findMarker(child, [...path, key]);
        if (found) return found;
      }
    }
    return null;
  };
  const path = findMarker(template);
  if (!path) throw new Error("Response format must include {{output}}.");
  let output = response;
  for (const segment of path) {
    if (output === null || typeof output !== "object" || !(segment in output)) throw new Error("The provider response did not match the configured response format.");
    output = (output as Record<string | number, unknown>)[segment];
  }
  if (typeof output === "string") return output;
  if (output === null || output === undefined) throw new Error("The configured {{output}} response value was empty.");
  return JSON.stringify(output);
}
