// Multi-Model Intelligence & Dynamic Routing for OpenCrewBot 2.0
// Supports OpenAI, Anthropic, Google Gemini, Nebius, Groq, Ollama (Local), and Local Mock.
// Provides task-based routing, automatic fallback handling, and real-time cost & token analytics.

import type { ModelOption } from "@/lib/shared/types";

export interface ModelProviderConfig {
  id: string;
  name: string;
  baseUrl?: string;
  apiKeyEnv: string;
  isAvailable: boolean;
  type: "hosted" | "local" | "mock";
}

export interface ModelAnalyticsRecord {
  modelId: string;
  provider: string;
  totalCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  isReal: boolean;
  executionType: "real" | "mock";
}

const analyticsStore = new Map<string, ModelAnalyticsRecord>();

export class MultiModelRouter {
  /**
   * Health check for the local Ollama provider.
   * Probes the Ollama HTTP API and calculates actual round-trip latency.
   */
  async checkOllamaHealth(customUrl?: string): Promise<{
    healthy: boolean;
    provider: "ollama";
    baseUrl: string;
    models: string[];
    activeModel: string;
    latencyMs: number;
    error?: string;
  }> {
    const baseUrl = (customUrl || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
    const targetModel = process.env.OLLAMA_MODEL || "qwen2.5:0.5b";
    const start = Date.now();

    try {
      const res = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(10000), // Strict 10-second timeout for Ollama health check
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          healthy: false,
          provider: "ollama",
          baseUrl,
          models: [],
          activeModel: targetModel,
          latencyMs,
          error: `Ollama returned HTTP status ${res.status}: ${res.statusText}`,
        };
      }

      const data = (await res.json()) as { models?: Array<{ name: string; size: number }> };
      const modelNames = (data.models ?? []).map((m) => m.name);
      const hasTargetModel = modelNames.some((n) => n === targetModel || n.startsWith(targetModel.split(":")[0]));

      return {
        healthy: true,
        provider: "ollama",
        baseUrl,
        models: modelNames,
        activeModel: targetModel,
        latencyMs,
        error: hasTargetModel ? undefined : `Model '${targetModel}' not downloaded. Available: ${modelNames.join(", ")}`,
      };
    } catch (err) {
      return {
        healthy: false,
        provider: "ollama",
        baseUrl,
        models: [],
        activeModel: targetModel,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : "Unable to reach Ollama service on " + baseUrl,
      };
    }
  }

  /**
   * Returns list of configured LLM providers and their operational availability.
   */
  getAvailableProviders(): ModelProviderConfig[] {
    return [
      {
        id: "ollama",
        name: "Ollama (Local Offline LLM)",
        baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
        apiKeyEnv: "NONE",
        isAvailable: true,
        type: "local",
      },
      {
        id: "nebius",
        name: "Nebius Token Factory",
        apiKeyEnv: "NEBIUS_API_KEY",
        isAvailable: Boolean(process.env.NEBIUS_API_KEY),
        type: "hosted",
      },
      {
        id: "openai",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKeyEnv: "OPENAI_API_KEY",
        isAvailable: Boolean(process.env.OPENAI_API_KEY),
        type: "hosted",
      },
      {
        id: "anthropic",
        name: "Anthropic Claude",
        baseUrl: "https://api.anthropic.com/v1",
        apiKeyEnv: "ANTHROPIC_API_KEY",
        isAvailable: Boolean(process.env.ANTHROPIC_API_KEY),
        type: "hosted",
      },
      {
        id: "gemini",
        name: "Google Gemini",
        apiKeyEnv: "GEMINI_API_KEY",
        isAvailable: Boolean(process.env.GEMINI_API_KEY),
        type: "hosted",
      },
      {
        id: "mock",
        name: "Local Scripted Mock (Testing Only)",
        apiKeyEnv: "NONE",
        isAvailable: true,
        type: "mock",
      },
    ];
  }

  /**
   * Intelligently selects the optimal model based on task complexity.
   */
  routeModelForTask(
    taskType: "planning" | "coding" | "financial" | "creative" | "classification" | "general",
    requestedModel?: string,
  ): { selectedModel: string; fallbackModel: string; provider: string } {
    const isLocal = process.env.AI_PROVIDER === "ollama" || !process.env.NEBIUS_API_KEY;

    if (isLocal) {
      const ollamaModel = process.env.OLLAMA_MODEL || "qwen2.5:0.5b";
      return {
        selectedModel: ollamaModel,
        fallbackModel: ollamaModel,
        provider: "ollama",
      };
    }

    if (requestedModel && requestedModel !== "auto") {
      return {
        selectedModel: requestedModel,
        fallbackModel: "MiniMaxAI/MiniMax-M3",
        provider: requestedModel.split("/")[0] || "hosted",
      };
    }

    switch (taskType) {
      case "planning":
      case "financial":
        return {
          selectedModel: "deepseek-ai/DeepSeek-V4-Pro",
          fallbackModel: "Qwen/Qwen3.5-397B-A17B",
          provider: "nebius",
        };
      case "coding":
        return {
          selectedModel: "moonshotai/Kimi-K2.7-Code",
          fallbackModel: "deepseek-ai/DeepSeek-V4.1-Flash",
          provider: "nebius",
        };
      case "creative":
        return {
          selectedModel: "MiniMaxAI/MiniMax-M3",
          fallbackModel: "deepseek-ai/DeepSeek-V4-Flash-0731",
          provider: "nebius",
        };
      case "classification":
        return {
          selectedModel: "deepseek-ai/DeepSeek-V4-Flash-0731",
          fallbackModel: "google/gemma-3-27b-it",
          provider: "nebius",
        };
      default:
        return {
          selectedModel: "MiniMaxAI/MiniMax-M3",
          fallbackModel: "deepseek-ai/DeepSeek-V4-Flash-0731",
          provider: "nebius",
        };
    }
  }

  /**
   * Records token usage and calculates USD cost, clearly distinguishing
   * real inference from mock testing executions.
   */
  trackUsage(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number | null,
    provider = "ollama",
    isReal = true,
  ) {
    const key = `${provider}:${modelId}`;
    const existing = analyticsStore.get(key) || {
      modelId,
      provider,
      totalCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCostUsd: 0,
      isReal,
      executionType: isReal ? "real" : "mock",
    };

    existing.totalCalls += 1;
    existing.inputTokens += inputTokens;
    existing.outputTokens += outputTokens;
    if (costUsd) {
      existing.totalCostUsd += costUsd;
    }

    analyticsStore.set(key, existing);
  }

  getAnalytics(): {
    totals: {
      calls: number;
      realCalls: number;
      mockCalls: number;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
    };
    byModel: ModelAnalyticsRecord[];
    providers: ModelProviderConfig[];
  } {
    const byModel = Array.from(analyticsStore.values());
    const totals = byModel.reduce(
      (acc, curr) => {
        acc.calls += curr.totalCalls;
        if (curr.isReal) {
          acc.realCalls += curr.totalCalls;
        } else {
          acc.mockCalls += curr.totalCalls;
        }
        acc.inputTokens += curr.inputTokens;
        acc.outputTokens += curr.outputTokens;
        acc.costUsd += curr.totalCostUsd;
        return acc;
      },
      { calls: 0, realCalls: 0, mockCalls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    );

    return {
      totals,
      byModel,
      providers: this.getAvailableProviders(),
    };
  }
}

export const multiModelRouter = new MultiModelRouter();
