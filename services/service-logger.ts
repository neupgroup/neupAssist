import "server-only";
import { logger } from "@neup/logica/logger";

/** Records a server service execution without logging credentials or payloads. */
export async function logServiceRun(service: string, details: Record<string, unknown> = {}) {
  try {
    await logger.type("service-run").data({ service, ...details }).log();
  } catch {
    // Logging must not interrupt the service operation.
  }
}
