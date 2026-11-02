"use client";

import { withAppBasePath } from "./app-url";

/** Browser-side service transport. UI code depends on domain operations, not API URLs. */
export async function serviceRequest(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(withAppBasePath(path), { cache: "no-store", ...options });
}

export const chatClientService = {
  list: () => serviceRequest("/bridge/api.v1/chats"),
  listApps: () => serviceRequest("/bridge/api.v1/applications"),
  get: (chatId: string) => serviceRequest("/bridge/api.v1/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId }) }),
  remove: (chatId: string) => serviceRequest(`/bridge/api.v1/chats?id=${encodeURIComponent(chatId)}`, { method: "DELETE" }),
  removeAll: () => serviceRequest("/bridge/api.v1/chats?all=true", { method: "DELETE" }),
  send: (messages: Array<{ role: "user" | "assistant"; content: string }>, chatId?: string, retryPending = false) => serviceRequest("/bridge/api.v1/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages, chatId, retryPending }) }),
};

export const keyClientService = {
  list: () => serviceRequest("/bridge/api.v1/manage/keys"),
  create: (data: unknown) => serviceRequest("/bridge/api.v1/manage/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  remove: (id: string) => serviceRequest(`/bridge/api.v1/manage/keys?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const apiTokenClientService = {
  list: () => serviceRequest("/bridge/api.v1/manage/api-keys"),
  create: (expiresInDays: number) => serviceRequest("/bridge/api.v1/manage/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresInDays }) }),
  remove: (id: string) => serviceRequest(`/bridge/api.v1/manage/api-keys?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
};

