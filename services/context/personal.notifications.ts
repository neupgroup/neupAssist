import "server-only";
import { getCookie } from "@neup/core/helpers/cookie";
import { logica } from "@neup/logica";
import { notification } from "@neup/logica/notification";

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

/** Loads notifications addressed to the currently signed-in account. */
export async function getPersonalNotifications(): Promise<PersonalNotifications> {
  const authAccountToken = (await getCookie("auth_account"))?.trim();
  if (!authAccountToken) {
    return { available: false, notifications: [], reason: "missing_auth_account" };
  }

  try {
    const account = await logica.account.lookup.current.get(authAccountToken, ["accountId", "connectionId"]);
    if (!account.ok || !account.body.success) {
      return { available: false, notifications: [], reason: "account_unavailable" };
    }

    const accountId = account.body.accountId;
    const connectionId = account.body.connectionId;
    if (!accountId && !connectionId) {
      return { available: false, notifications: [], reason: "account_unavailable" };
    }

    const response = await notification.filter({
      ...(accountId ? { accountId } : { connectionId }),
      limit: 50,
    }).get();
    if (!response.ok || !response.body.success) {
      return { available: false, notifications: [], reason: "notifications_unavailable" };
    }

    return {
      available: true,
      notifications: response.body.data.map(({ id, title, message, type, read, createdAt, action, detail }) => ({
        id,
        title,
        message,
        type,
        read,
        createdAt,
        action,
        detail,
      })),
    };
  } catch {
    return { available: false, notifications: [], reason: "notifications_unavailable" };
  }
}
