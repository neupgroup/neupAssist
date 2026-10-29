import "server-only";
import { logica } from "@neup/logica";
import { logger } from "@neup/logica/logger";
import { logServiceRun } from "@/services/service-logger";

export type PersonalNotifications = {
  available: boolean;
  notifications: Array<{
    id: string;
    title: string | null;
    message: string | null;
    type: string;
    read: boolean;
    createdAt: string;
    action: string | null;
    detail: unknown;
  }>;
  reason?: "missing_auth_account" | "account_unavailable" | "notifications_unavailable";
};

/** Logs notification lookup results without including the account authentication token. */
async function logNotificationLookup(data: Record<string, unknown>) {
  try {
    await logger.type("context-personal-notifications").data(data).log();
  } catch {
    // Logging must not interrupt context collection.
  }
}

/** Loads notifications addressed to the currently signed-in account. */
export async function getPersonalNotifications(authAccountToken?: string | null): Promise<PersonalNotifications> {
  await logServiceRun("context.personal.notifications");
  const accountToken = authAccountToken?.trim();
  if (!accountToken) {
    await logNotificationLookup({ outcome: "missing_auth_account", authAccountTokenReceived: false });
    return { available: false, notifications: [], reason: "missing_auth_account" };
  }

  await logNotificationLookup({
    outcome: "auth_account_received",
    authAccountTokenReceived: true,
    authAccountTokenLength: accountToken.length,
  });

  try {
    const account = await logica.account.lookup.current.get(accountToken, ["accountId", "connectionId"]);
    if (!account.ok || !account.body.success) {
      await logNotificationLookup({ outcome: "account_lookup_failed", status: account.status, success: account.body.success });
      return { available: false, notifications: [], reason: "account_unavailable" };
    }

    const accountId = account.body.accountId;
    const connectionId = account.body.connectionId;
    if (!accountId && !connectionId) {
      await logNotificationLookup({ outcome: "account_identifiers_missing", hasAccountId: false, hasConnectionId: false });
      return { available: false, notifications: [], reason: "account_unavailable" };
    }

    const response = await logica.notification.filter({
      ...(accountId ? { accountId } : { connectionId }),
      limit: 50,
    }).get();
    if (!response.ok || !response.body.success) {
      await logNotificationLookup({ outcome: "notifications_lookup_failed", status: response.status, success: response.body.success });
      return { available: false, notifications: [], reason: "notifications_unavailable" };
    }

    const notifications = response.body.data.map(({ id, title, message, type, read, createdAt, action, detail }) => ({
      id,
      title,
      message,
      type,
      read,
      createdAt,
      action,
      detail,
    }));
    await logNotificationLookup({ outcome: "success", status: response.status, count: notifications.length, notifications });

    return {
      available: true,
      notifications,
    };
  } catch {
    await logNotificationLookup({ outcome: "request_exception" });
    return { available: false, notifications: [], reason: "notifications_unavailable" };
  }
}
