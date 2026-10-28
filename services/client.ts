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

export const providerClientService = {
  list: () => serviceRequest("/api/manage/providers"),
  get: (id: number) => serviceRequest(`/api/manage/providers/${id}`),
  create: (data: unknown) => serviceRequest("/api/manage/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  update: (id: number, data: unknown) => serviceRequest(`/api/manage/providers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  setStatus: (id: number, status: string) => serviceRequest("/api/manage/providers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }),
  remove: (id: number) => serviceRequest(`/api/manage/providers?id=${id}`, { method: "DELETE" }),
  test: (id: number, reqMethod?: string) => serviceRequest(`/api/manage/providers/${id}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reqMethod }) }),
};

export const modelClientService = {
  list: () => serviceRequest("/api/manage/models"),
  get: (id: number) => serviceRequest(`/api/manage/models/${id}`),
  create: (data: unknown) => serviceRequest("/api/manage/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  update: (id: number, data: unknown) => serviceRequest(`/api/manage/models/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  reorder: (ids: number[]) => serviceRequest("/api/manage/models", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }),
  remove: (id: number) => serviceRequest(`/api/manage/models?id=${id}`, { method: "DELETE" }),
};
