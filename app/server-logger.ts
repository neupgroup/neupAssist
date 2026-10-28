import { logger } from "@neup/logica/logger";

/** Redacts credential-like URL parameters while retaining the provider endpoint. */
function redactRequestUrl(value: string) {
  try {
    const url = new URL(value);
    for (const key of url.searchParams.keys()) {
      if (/key|token|secret|auth/i.test(key)) url.searchParams.set(key, "[REDACTED]");
    }
    return url.toString();
  } catch {
    return redactLogSecrets(value);
  }
}

/** Removes authentication headers before an outgoing request is logged. */
function redactRequestHeaders(headers: Headers) {
  return Object.fromEntries(Array.from(headers.entries(), ([name, value]) => [
    name,
    /authorization|api[-_]?key|token|secret|cookie/i.test(name) ? "[REDACTED]" : redactLogSecrets(value),
  ]));
}

/** Redacts configured secrets and provider URLs from free-form log text. */
export function redactLogSecrets(value: string, additionalSecrets: string[] = []) {
  let redacted = value.replace(/https?:\/\/[^\s"']+/g, "[provider URL redacted]");
  for (const [name, secret] of Object.entries(process.env)) {
    if (secret && secret.length > 7 && /KEY|SECRET|TOKEN|DATABASE_URL/i.test(name)) {
      redacted = redacted.replaceAll(secret, `[${name} redacted]`);
    }
  }
  for (const secret of additionalSecrets) {
    if (secret) redacted = redacted.replaceAll(secret, "[API key redacted]");
  }
  return redacted;
}

/** Logs the outgoing provider request with credentials and sensitive URL values redacted. */
export async function logAIRequest(input: {
  provider: string;
  model: string;
  url: string;
  method: string;
  headers: Headers;
  body?: BodyInit;
  apiKey: string;
}) {
  const body = typeof input.body === "string" ? redactLogSecrets(input.body, [input.apiKey]) : input.body === undefined ? null : "[non-text request body]";
  try {
    await logger.type("ai-request").data({
      provider: input.provider,
      model: input.model,
      method: input.method,
      url: redactRequestUrl(input.url),
      headers: redactRequestHeaders(input.headers),
      body,
    }).log();
  } catch {
    // Logging failures must not interrupt provider requests.
  }
}

/** Writes an application error while removing supplied credentials from it. */
export async function logApplicationError(error: unknown, context: string, additionalSecrets: string[] = []) {
  const message = error instanceof Error
    ? `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`
    : String(error);

  try {
    await logger.type("error").data({ context, message: redactLogSecrets(message, additionalSecrets) }).log();
  } catch {
    // Logging failures must not interrupt the request that is reporting an error.
  }
}
