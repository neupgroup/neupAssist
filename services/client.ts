"use client";

/** Browser-side service transport. UI code depends on domain operations, not API URLs. */
export async function serviceRequest(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(path, { cache: "no-store", ...options });
}

export const chatClientService = {
  list: () => serviceRequest("/api/chats"),
  get: (chatId: number) => serviceRequest("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId }) }),
  send: (messages: Array<{ role: "user" | "assistant"; content: string }>, chatId?: number) => serviceRequest("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages, chatId }) }),
};

export const keyClientService = {
  list: () => serviceRequest("/api/manage/keys"),
  create: (data: unknown) => serviceRequest("/api/manage/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  remove: (id: number) => serviceRequest(`/api/manage/keys?id=${id}`, { method: "DELETE" }),
};

