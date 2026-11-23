// The model picker's catalog. A static list (from models.dev, the same source
// Mastra's model router uses) keeps the picker useful before a key is added;
// with NEBIUS_API_KEY set, the live Token Factory list decides what's available.
import type { ModelOption } from "@/lib/shared/types";

export const DEFAULT_MODEL = process.env.AI_PROVIDER === "nebius" ? "MiniMaxAI/MiniMax-M3" : (process.env.OLLAMA_MODEL || "qwen2.5:0.5b");

type Row = [id: string, context: number, tools: boolean, reasoning: boolean, vision: boolean, inPerM: number, outPerM: number];

const STATIC: Row[] = [
  // Local Ollama Models (Free, Local, Zero Cloud Cost)
  ["qwen2.5:0.5b", 32768, true, true, false, 0, 0],
  ["qwen2.5:1.5b", 32768, true, true, false, 0, 0],
  ["llama3.2:1b", 131072, true, true, false, 0, 0],
  ["llama3.2:3b", 131072, true, true, false, 0, 0],
  ["phi3:mini", 128000, true, true, false, 0, 0],

  // Hosted Cloud Models (Nebius Token Factory)
  ["MiniMaxAI/MiniMax-M3", 1048576, true, true, false, 0.3, 1.2],
  ["deepseek-ai/DeepSeek-V4-Flash-0731", 1024000, true, true, false, 0.14, 0.28],
  ["deepseek-ai/DeepSeek-V4.1-Flash", 1048000, true, true, true, 0.3, 1.2],
  ["deepseek-ai/DeepSeek-V4-Pro", 1048576, true, true, false, 1.75, 3.5],
  ["Qwen/Qwen3.5-397B-A17B", 262144, true, true, false, 0.6, 3.6],
  ["Qwen/Qwen3.8-27B", 262144, true, true, false, 0.45, 3],
  ["Qwen/Qwen3-235B-A22B-Instruct-2507", 262144, true, false, false, 0.2, 0.6],
  ["Qwen/Qwen3-30B-A3B-Instruct-2507", 262144, true, false, false, 0.1, 0.3],
  ["zai-org/GLM-5.3", 1024000, true, true, false, 1.4, 4.4],
  ["zai-org/GLM-5.3-Flash", 1024000, true, true, false, 0.15, 0.5],
  ["moonshotai/Kimi-K3", 1048576, true, true, false, 3, 15],
  ["moonshotai/Kimi-K2.7-Code", 262144, true, true, false, 0.95, 4],
  ["nvidia/Nemotron-3_5-Lightning", 1048576, true, true, false, 0.06, 0.24],
  ["nvidia/nemotron-3-super-120b-a12b", 262144, true, true, false, 0.3, 0.9],
  ["nvidia/Nemotron-3-Ultra-550b-a55b", 1048576, true, true, false, 1, 3],
  ["openai/gpt-oss-120b", 131072, true, true, false, 0.15, 0.6],
  ["NousResearch/Hermes-4-405B", 131072, true, true, false, 1, 3],
  ["google/gemma-3-27b-it", 110000, true, false, true, 0.1, 0.3],
];

function label(id: string): string {
  if (id.startsWith("qwen") || id.startsWith("llama") || id.startsWith("phi")) {
    return `${id} (Local Ollama)`;
  }
  const name = id.split("/").pop() ?? id;
  return name.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

function fromRow([id, context, tools, reasoning, vision, inPerM, outPerM]: Row, live = false): ModelOption {
  const isOllama = !id.includes("/") || id.startsWith("ollama");
  return {
    id,
    label: label(id),
    provider: isOllama ? "Ollama" : id.split("/")[0],
    context,
    tools,
    reasoning,
    vision,
    inputPerM: inPerM,
    outputPerM: outPerM,
    live,
  };
}

const staticOptions = STATIC.map((r) => fromRow(r));

interface LiveModel {
  id: string;
  name?: string;
  context_length?: number;
  architecture?: { modality?: string };
  pricing?: { prompt?: string; completion?: string };
  supported_features?: string[] | null;
  status?: string | null;
}

const g = globalThis as unknown as { __opencrewbotModels?: { at: number; options: ModelOption[] } };
const LIVE_TTL_MS = 10 * 60 * 1000;

async function fetchLive(): Promise<ModelOption[] | null> {
  const key = process.env.NEBIUS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.tokenfactory.nebius.com/v1/models?verbose=true", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: LiveModel[] };
    const known = new Map(staticOptions.map((o) => [o.id, o]));
    const options: ModelOption[] = [];
    for (const m of json.data ?? []) {
      const modality = m.architecture?.modality ?? "text->text";
      if (!modality.endsWith("->text")) continue; // skip embedding / image models
      if (m.status && m.status !== "active") continue;
      const base = known.get(m.id);
      // Nebius's own display name and feature flags win; the built-in list fills gaps.
      const features = m.supported_features ? new Set(m.supported_features.map((f) => f.toLowerCase())) : null;
      const name = m.name ? label(m.name.split("/").pop() ?? m.name) : undefined;
      // Prices come per token; show them per million, without float noise (0.09999… → 0.1).
      const perM = (v?: string) => (v === undefined ? null : Math.round(Number(v) * 1e6 * 10_000) / 10_000);
      options.push({
        id: m.id,
        label: name ?? base?.label ?? label(m.id),
        provider: m.id.split("/")[0],
        context: m.context_length ?? base?.context ?? 0,
        tools: features ? features.has("tools") : (base?.tools ?? false),
        reasoning: features ? features.has("reasoning") : (base?.reasoning ?? false),
        vision: base?.vision ?? modality.includes("image"),
        inputPerM: perM(m.pricing?.prompt) ?? base?.inputPerM ?? null,
        outputPerM: perM(m.pricing?.completion) ?? base?.outputPerM ?? null,
        live: true,
      });
    }
    return options.length ? options : null;
  } catch {
    return null;
  }
}

async function fetchOllama(): Promise<ModelOption[]> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: Array<{ name: string; size: number }> };
    return (data.models ?? []).map((m) => ({
      id: m.name,
      label: `${m.name} (Local Ollama)`,
      provider: "Ollama",
      context: 32768,
      tools: true,
      reasoning: true,
      vision: false,
      inputPerM: 0,
      outputPerM: 0,
      live: true,
    }));
  } catch {
    return [];
  }
}

/** The catalog, live from Token Factory when a key is set and Ollama locally. `fresh` skips the cache. */
export async function listModels(fresh = false): Promise<ModelOption[]> {
  const cached = g.__opencrewbotModels;
  if (!fresh && cached && Date.now() - cached.at < LIVE_TTL_MS) return cached.options;
  
  const [liveNebius, liveOllama] = await Promise.all([fetchLive(), fetchOllama()]);
  const baseList = liveNebius ?? staticOptions;
  
  // Merge live Ollama models at top
  const merged = [...liveOllama, ...baseList.filter((b) => !liveOllama.some((o) => o.id === b.id))];
  const options = merged.slice().sort((a, b) => (a.provider === "Ollama" ? -1 : 1) || Number(b.tools) - Number(a.tools) || a.id.localeCompare(b.id));
  
  g.__opencrewbotModels = { at: Date.now(), options };
  return options;
}

export async function findModel(id: string): Promise<ModelOption | undefined> {
  return (await listModels()).find((m) => m.id === id) ?? staticOptions.find((m) => m.id === id);
}

export function costUsd(model: ModelOption | undefined, input: number, output: number): number | null {
  if (!model || model.inputPerM === null || model.outputPerM === null) return null;
  return (input * model.inputPerM + output * model.outputPerM) / 1e6;
}
