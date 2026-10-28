import "server-only";
import { prisma } from "../prisma/client/server";

export const listKeys = async () => {
  const keys = await prisma.intelligenceKey.findMany({ select: { id: true, provider: true, model_id: true, key: true, addedOn: true, updatedOn: true, balance: true, modelInfo: { select: { name: true } } }, orderBy: { addedOn: "desc" } });
  return keys.map(({ key, balance, modelInfo, ...entry }) => ({ ...entry, modelName: modelInfo?.name ?? null, keyPreview: key.length > 8 ? `${key.slice(0, 4)}••••${key.slice(-4)}` : "••••••••", balance: balance?.toString() ?? null }));
};
export const listProviders = () => prisma.intelligenceProvider.findMany({ select: { id: true, name: true, code: true, created_on: true, status: true }, orderBy: [{ created_on: "desc" }, { id: "desc" }] });
export const getProvider = (id: number) => prisma.intelligenceProvider.findUnique({ where: { id }, select: { id: true, name: true, code: true, created_on: true, status: true, reqMethod: true, models: { select: { id: true, name: true, code: true, status: true }, orderBy: [{ order_index: "asc" }, { added_on: "asc" }] } } });
const modelSelect = { id: true, provider_id: true, name: true, code: true, cost_input: true, cost_output: true, reqMethod: true, status: true, order_index: true, added_on: true, provider: { select: { id: true, name: true, code: true } } } as const;
const serializeModel = <T extends { cost_input: { toString(): string }; cost_output: { toString(): string } }>(model: T) => ({ ...model, cost_input: model.cost_input.toString(), cost_output: model.cost_output.toString() });
export const listModels = async () => (await prisma.intelligenceModel.findMany({ select: modelSelect, orderBy: [{ order_index: "asc" }, { added_on: "desc" }] })).map(serializeModel);
export const getModel = async (id: number) => { const model = await prisma.intelligenceModel.findUnique({ where: { id }, select: modelSelect }); return model ? serializeModel(model) : null; };

export async function saveKey(data: Record<string, unknown>) {
  const provider = typeof data.provider === "string" ? data.provider.trim() : "";
  const modelId = data.model_id === null || data.model_id === undefined || data.model_id === "" ? null : Number(data.model_id);
  const key = typeof data.key === "string" ? data.key.trim() : "";
  const uncapped = data.balance === null;
  const balance = typeof data.balance === "string" || typeof data.balance === "number" ? String(data.balance).trim() : "";
  if (!provider || !key || (modelId !== null && (!Number.isSafeInteger(modelId) || modelId < 1)) || (!uncapped && (!balance || !/^\d+(\.\d{1,8})?$/.test(balance)))) return { error: "Provider, key, and a valid balance (up to 8 decimal places) are required, or select Uncapped.", status: 400 } as const;
  if (modelId !== null) { const selected = await prisma.intelligenceModel.findUnique({ where: { id: modelId }, include: { provider: { select: { name: true, code: true } } } }); if (!selected || (selected.provider.name.toLowerCase() !== provider.toLowerCase() && selected.provider.code.toLowerCase() !== provider.toLowerCase())) return { error: "Choose a model belonging to the selected provider.", status: 400 } as const; }
  const created = await prisma.intelligenceKey.create({ data: { provider, model_id: modelId, key, balance: uncapped ? null : balance }, select: { id: true, provider: true, model_id: true, addedOn: true, updatedOn: true, balance: true, modelInfo: { select: { name: true } } } });
  return { ...created, modelName: created.modelInfo?.name ?? null, modelInfo: undefined, balance: created.balance?.toString() ?? null };
}
export async function createProvider(data: Record<string, unknown>) {
  const name = typeof data.name === "string" ? data.name.trim() : "", code = typeof data.code === "string" ? data.code.trim().toLowerCase() : "", reqMethod = typeof data.reqMethod === "string" && data.reqMethod.trim() ? data.reqMethod : null, status = typeof data.status === "string" ? data.status.trim().toLowerCase() : "active";
  if (!name || !/^[a-z0-9][a-z0-9_-]{1,49}$/.test(code) || !["active", "inactive"].includes(status)) return { error: "Enter a name, a code using letters/numbers/dashes/underscores, and a valid status.", status: 400 } as const;
  return prisma.intelligenceProvider.create({ data: { name, code, status, reqMethod }, select: { id: true, name: true, code: true, created_on: true, status: true } });
}
export async function setProviderStatus(id: number, status: string) { return prisma.intelligenceProvider.update({ where: { id }, data: { status } }); }
export async function updateProvider(id: number, data: Record<string, unknown>) {
  const name = typeof data.name === "string" ? data.name.trim() : "", code = typeof data.code === "string" ? data.code.trim().toLowerCase() : "", status = typeof data.status === "string" ? data.status.trim().toLowerCase() : "", reqMethod = typeof data.reqMethod === "string" && data.reqMethod.trim() ? data.reqMethod : null;
  if (!name || !/^[a-z0-9][a-z0-9_-]{1,49}$/.test(code) || !["active", "inactive"].includes(status)) return { error: "Enter a name, a valid provider code, and status.", status: 400 } as const;
  return prisma.intelligenceProvider.update({ where: { id }, data: { name, code, status, reqMethod }, select: { id: true, name: true, code: true, created_on: true, status: true, reqMethod: true, models: { select: { id: true, name: true, code: true, status: true }, orderBy: [{ order_index: "asc" }, { added_on: "asc" }] } } });
}
export async function createModel(data: Record<string, unknown>) {
  const provider_id = Number(data.provider_id), name = typeof data.name === "string" ? data.name.trim() : "", code = typeof data.code === "string" ? data.code.trim() : "", reqMethod = typeof data.reqMethod === "string" && data.reqMethod.trim() ? data.reqMethod : null, status = typeof data.status === "string" ? data.status.trim() : "", cost_input = typeof data.cost_input === "string" || typeof data.cost_input === "number" ? String(data.cost_input).trim() : "", cost_output = typeof data.cost_output === "string" || typeof data.cost_output === "number" ? String(data.cost_output).trim() : "", validCost = (cost: string) => /^\d+(\.\d{1,8})?$/.test(cost);
  if (!Number.isSafeInteger(provider_id) || provider_id < 1 || !name || !code || !["active", "inactive"].includes(status.toLowerCase()) || !validCost(cost_input) || !validCost(cost_output)) return { error: "Select a provider, enter a model name and code, status, and valid non-negative costs (up to 8 decimal places).", status: 400 } as const;
  const maximum = await prisma.intelligenceModel.aggregate({ _max: { order_index: true } });
  const model = await prisma.intelligenceModel.create({ data: { provider_id, name, code, reqMethod, cost_input, cost_output, status, order_index: (maximum._max.order_index ?? -1) + 1 }, select: modelSelect });
  return serializeModel(model);
}
export async function updateModel(id: number, data: Record<string, unknown>) {
  const name = typeof data.name === "string" ? data.name.trim() : "", provider_id = Number(data.provider_id), code = typeof data.code === "string" ? data.code.trim() : "", cost_input = typeof data.cost_input === "string" || typeof data.cost_input === "number" ? String(data.cost_input).trim() : "", cost_output = typeof data.cost_output === "string" || typeof data.cost_output === "number" ? String(data.cost_output).trim() : "", status = typeof data.status === "string" ? data.status.trim().toLowerCase() : "", reqMethod = typeof data.reqMethod === "string" && data.reqMethod.trim() ? data.reqMethod : null, validCost = (cost: string) => /^\d+(\.\d{1,8})?$/.test(cost);
  if (!name || !code || !Number.isSafeInteger(provider_id) || provider_id < 1 || !validCost(cost_input) || !validCost(cost_output) || !["active", "inactive"].includes(status)) return { error: "Enter a model name and code, provider, valid non-negative costs, and status.", status: 400 } as const;
  return serializeModel(await prisma.intelligenceModel.update({ where: { id }, data: { name, code, provider_id, cost_input, cost_output, status, reqMethod }, select: modelSelect }));
}
export async function reorderModels(ids: number[]) {
  const existing = await prisma.intelligenceModel.findMany({ select: { id: true } });
  if (existing.length !== ids.length || existing.some(({ id }) => !ids.includes(id))) return { error: "The model list changed. Refresh and try again.", status: 409 } as const;
  await prisma.$transaction(ids.map((id, index) => prisma.intelligenceModel.update({ where: { id }, data: { order_index: index } })));
  return { success: true };
}
export const deleteKey = async (id: number) => { await prisma.intelligenceKey.delete({ where: { id } }); return { success: true }; };
export const deleteProvider = async (id: number) => { await prisma.intelligenceProvider.delete({ where: { id } }); return { success: true }; };
export const deleteModel = async (id: number) => { await prisma.intelligenceModel.delete({ where: { id } }); return { success: true }; };
