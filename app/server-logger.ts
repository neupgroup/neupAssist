import { logger } from "@neup/logica/logger";

function redactSecrets(value: string, additionalSecrets: string[] = []) {
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

export async function logApplicationError(error: unknown, context: string, additionalSecrets: string[] = []) {
  const message = error instanceof Error
    ? `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`
    : String(error);

  try {
    await logger.type("error").data({ context, message: redactSecrets(message, additionalSecrets) }).log();
  } catch {
    // Logging failures must not interrupt the request that is reporting an error.
  }
}
