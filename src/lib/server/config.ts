import { existsSync, mkdirSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import type { AppStatus } from "@/lib/shared/types";

// The data folder is chosen at runtime, so keep the bundler from tracing it.
export const DATA_DIR = resolve(/*turbopackIgnore: true*/ process.env.OPENCREWBOT_DATA_DIR || "./data");
export const WORKSPACES_DIR = resolve(DATA_DIR, "workspaces");
mkdirSync(WORKSPACES_DIR, { recursive: true });

// The app was called CrewRoom before; carry an existing database over once.
const APP_DB_PATH = resolve(DATA_DIR, "opencrewbot.db");
const LEGACY_DB_PATH = resolve(DATA_DIR, "crewroom.db");
if (!existsSync(APP_DB_PATH) && existsSync(LEGACY_DB_PATH)) renameSync(LEGACY_DB_PATH, APP_DB_PATH);

export const APP_DB_URL = `file:${APP_DB_PATH}`;
export const MASTRA_DB_URL = `file:${resolve(DATA_DIR, "mastra.db")}`;

/** The single local owner every bot thread belongs to. */
export const OWNER_ID = "owner";

export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:0.5b";
export const AI_PROVIDER = process.env.AI_PROVIDER || (process.env.NEBIUS_API_KEY ? "nebius" : "ollama");

export const keys = {
  nebius: () => Boolean(process.env.NEBIUS_API_KEY),
  ollama: () => true, // Local Ollama is available
  tavily: () => Boolean(process.env.TAVILY_API_KEY),
  jev: () => Boolean(process.env.TYPESAFE_API_KEY),
  browserbase: () => Boolean(process.env.BROWSERBASE_API_KEY),
  composio: () => Boolean(process.env.COMPOSIO_API_KEY),
};

/** Mock mode is ONLY used when explicitly requested via MOCK_MODE=true or AI_PROVIDER=mock. */
export const isMock = () => process.env.MOCK_MODE === "true" || process.env.AI_PROVIDER === "mock";

export function appStatus(): AppStatus {
  return {
    mock: isMock(),
    provider: isMock() ? "mock" : AI_PROVIDER,
    ollamaBaseUrl: OLLAMA_BASE_URL,
    ollamaModel: OLLAMA_MODEL,
    keys: {
      nebius: keys.nebius(),
      ollama: keys.ollama(),
      tavily: keys.tavily(),
      jev: keys.jev(),
      browserbase: keys.browserbase(),
      composio: keys.composio(),
    },
    dataDir: DATA_DIR,
  };
}
