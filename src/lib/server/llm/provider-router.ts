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
}

const analyticsStore = new Map<string, ModelAnalyticsRecord>();

export class MultiModelRouter {
  /**
   * Returns list of configured LLM providers and their operational availability.
   */
  getAvailableProviders(): ModelProviderConfig[] {
    return [
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
        id: "ollama",
        name: "Ollama (Local Endpoint)",
        baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        apiKeyEnv: "NONE",
        isAvailable: Boolean(process.env.OLLAMA_ENABLED === "true"),
        type: "local",
      },
      {
        id: "mock",
        name: "Local Deterministic Mock",
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
   * Records token usage and calculates USD cost.
   */
  trackUsage(modelId: string, inputTokens: number, outputTokens: number, costUsd: number | null) {
    const existing = analyticsStore.get(modelId) || {
      modelId,
      provider: modelId.split("/")[0] || "unknown",
      totalCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCostUsd: 0,
    };

    existing.totalCalls += 1;
    existing.inputTokens += inputTokens;
    existing.outputTokens += outputTokens;
    if (costUsd) {
      existing.totalCostUsd += costUsd;
    }

    analyticsStore.set(modelId, existing);
  }

  getAnalytics(): {
    totals: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
    byModel: ModelAnalyticsRecord[];
    providers: ModelProviderConfig[];
  } {
    const byModel = Array.from(analyticsStore.values());
    const totals = byModel.reduce(
      (acc, curr) => {
        acc.calls += curr.totalCalls;
        acc.inputTokens += curr.inputTokens;
        acc.outputTokens += curr.outputTokens;
        acc.costUsd += curr.totalCostUsd;
        return acc;
      },
      { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    );

    return {
      totals,
      byModel,
      providers: this.getAvailableProviders(),
    };
  }
}

export const multiModelRouter = new MultiModelRouter();
