import * as googleGemini from "./google.gemini-3.1-flash-lite";
import * as googleApisGemini from "./googleapis.gemini-3.1-flash-lite";
import * as nvidiaNemotron from "./nvidia.nemotron-3.5-bolt-e4b";
import { defaultModel as defaultGoogleModel } from "./google.default";
import { defaultModel as defaultNvidiaModel } from "./nvidia.default";

type ModelDefinition = { fileName: string; provider: string; modelName: string; inputCostPerToken: number; outputCostPerToken: number };

/** Associates model implementation filenames with their API model names and pricing constants. */
const modelDefinitions: ModelDefinition[] = [
  { fileName: "google.gemini-3.1-flash-lite", provider: "google", modelName: googleGemini.modelId, inputCostPerToken: googleGemini.inputCostPerToken, outputCostPerToken: googleGemini.outputCostPerToken },
  { fileName: "googleapis.gemini-3.1-flash-lite", provider: "google", modelName: googleApisGemini.modelId, inputCostPerToken: googleApisGemini.inputCostPerToken, outputCostPerToken: googleApisGemini.outputCostPerToken },
  { fileName: "nvidia.nemotron-3.5-bolt-e4b", provider: "nvidia", modelName: nvidiaNemotron.modelId, inputCostPerToken: nvidiaNemotron.inputCostPerToken, outputCostPerToken: nvidiaNemotron.outputCostPerToken },
];

/** Resolves a configured model filename to the provider model name used by its API adapter. */
export function resolveModelDefinition(provider: string, selectedModel: string) {
  const normalizedProvider = provider.trim().toLowerCase();
  const fileDefinition = modelDefinitions.find((definition) => definition.fileName === selectedModel.trim());
  if (fileDefinition) return fileDefinition;
  const providerDefault = normalizedProvider === "google" ? defaultGoogleModel : normalizedProvider === "nvidia" ? defaultNvidiaModel : "";
  const selected = selectedModel.trim() || providerDefault;
  return modelDefinitions.find((definition) => definition.provider === normalizedProvider && definition.modelName === selected)
    ?? modelDefinitions.find((definition) => definition.provider === normalizedProvider && definition.fileName === selected)
    ?? { fileName: "", provider: normalizedProvider, modelName: selected, inputCostPerToken: 0, outputCostPerToken: 0 };
}

/** Calculates usage cost using the constants owned by the selected model file. */
export function calculateModelUsageCost(modelFileName: string, inputTokens: number, outputTokens: number) {
  const definition = modelDefinitions.find(({ fileName }) => fileName === modelFileName);
  if (!definition) return "0.0000000000000000";
  const totalCost = inputTokens * definition.inputCostPerToken + outputTokens * definition.outputCostPerToken;
  return (Number.isFinite(totalCost) && totalCost > 0 ? totalCost : 0).toFixed(16);
}
