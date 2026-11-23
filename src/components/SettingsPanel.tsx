"use client";

import clsx from "clsx";
import { ArrowUpRight, Cpu, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useApp } from "./OpenCrewBotApp";
import { Drawer } from "./ui";

function KeyRow({ name, envVar, ok, what, href }: { name: string; envVar: string; ok: boolean; what: string; href: string }) {
  return (
    <li className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14.5px] font-medium">{name}</span>
        <span className={clsx("flex items-center gap-1.5 text-[12.5px]", ok ? "text-ok" : "text-faint")}>
          <span className={clsx("h-2 w-2 rounded-full", ok ? "bg-ok" : "bg-[#3a3a3a]")} />
          {ok ? "Connected" : "Not set"}
        </span>
      </div>
      <p className="mt-1 text-[13px] leading-snug text-mute">{what}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <code className="rounded-md bg-raised-2 px-1.5 py-0.5 font-mono text-[12px] text-mute">{envVar}</code>
        <a className="inline-flex items-center gap-0.5 text-[12.5px] text-mute hover:text-ink" href={href} target="_blank" rel="noopener noreferrer">
          Get a key <ArrowUpRight size={13} />
        </a>
      </div>
    </li>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { state } = useApp();
  const status = state.status;

  const [healthStatus, setHealthStatus] = useState<{
    loading: boolean;
    healthy?: boolean;
    activeModel?: string;
    latencyMs?: number;
    error?: string;
    models?: string[];
  }>({ loading: true });

  const checkHealth = async () => {
    setHealthStatus((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/models/health");
      const data = await res.json();
      setHealthStatus({
        loading: false,
        healthy: data.healthy,
        activeModel: data.activeModel,
        latencyMs: data.latencyMs,
        error: data.error,
        models: data.models,
      });
    } catch (err) {
      setHealthStatus({
        loading: false,
        healthy: false,
        error: err instanceof Error ? err.message : "Failed to query health endpoint",
      });
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <Drawer title="Settings & AI Providers" onClose={onClose}>
      {/* Local AI Provider Section */}
      <section className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="text-accent" size={18} />
            <h3 className="text-[13.5px] font-semibold text-ink">Local AI Engine (Ollama)</h3>
          </div>
          <button
            type="button"
            onClick={checkHealth}
            disabled={healthStatus.loading}
            className="flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline disabled:opacity-50"
          >
            <RefreshCw size={12} className={clsx(healthStatus.loading && "animate-spin")} />
            Test Health
          </button>
        </div>
        <p className="mt-1 text-[13px] text-mute">
          Enables genuine local, offline model inference. No external API keys or cloud tokens required.
        </p>

        <div className="mt-3 rounded-2xl bg-raised p-4 ring-1 ring-line">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink">Provider Status:</span>
            {healthStatus.loading ? (
              <span className="flex items-center gap-1.5 text-[12px] text-mute">
                <RefreshCw size={12} className="animate-spin" /> Checking...
              </span>
            ) : healthStatus.healthy ? (
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ok">
                <CheckCircle2 size={14} /> Online ({healthStatus.latencyMs}ms)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-red-400">
                <AlertCircle size={14} /> Unavailable
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-lg bg-raised-2 p-2.5">
              <span className="text-faint">Endpoint:</span>
              <p className="font-mono text-mute">{status?.ollamaBaseUrl || "http://127.0.0.1:11434"}</p>
            </div>
            <div className="rounded-lg bg-raised-2 p-2.5">
              <span className="text-faint">Active Model:</span>
              <p className="font-mono font-medium text-ink">{status?.ollamaModel || healthStatus.activeModel || "qwen2.5:0.5b"}</p>
            </div>
          </div>

          {healthStatus.models && healthStatus.models.length > 0 && (
            <div className="mt-2.5 text-[12px] text-mute">
              <span className="text-faint">Installed Local Models:</span> {healthStatus.models.join(", ")}
            </div>
          )}

          {healthStatus.error && (
            <p className="mt-2.5 rounded-lg bg-red-950/40 p-2 font-mono text-[11.5px] text-red-300">
              {healthStatus.error}
            </p>
          )}
        </div>
      </section>

      {/* Hosted Provider API Keys */}
      <section>
        <h3 className="text-[12.5px] font-medium text-mute">Hosted AI Providers (Optional)</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-mute">
          When cloud keys are configured in <code className="rounded-md bg-raised-2 px-1 font-mono text-[12px]">.env</code>, agents can route heavy tasks to high-parameter cloud models.
        </p>
        <ul className="mt-3 divide-y divide-line rounded-2xl bg-raised">
          <KeyRow
            name="Nebius Token Factory"
            envVar="NEBIUS_API_KEY"
            ok={Boolean(status?.keys.nebius)}
            what="Hosted open-source models: DeepSeek, Qwen 3.5, MiniMax, GLM."
            href="https://tokenfactory.nebius.com"
          />
          <KeyRow name="Tavily Search" envVar="TAVILY_API_KEY" ok={Boolean(status?.keys.tavily)} what="Web search, page reading and site crawls." href="https://app.tavily.com" />
          <KeyRow
            name="Browserbase"
            envVar="BROWSERBASE_API_KEY"
            ok={Boolean(status?.keys.browserbase)}
            what="Cloud browsers for bots with the Browser tool. Watch them live and take over."
            href="https://www.browserbase.com"
          />
          <KeyRow
            name="Composio"
            envVar="COMPOSIO_API_KEY"
            ok={Boolean(status?.keys.composio)}
            what="Connected apps: Slack, GitHub, Gmail, Notion and 1,000+ more."
            href="https://platform.composio.dev"
          />
          <KeyRow
            name="Jev (TypeSafe)"
            envVar="TYPESAFE_API_KEY"
            ok={Boolean(status?.keys.jev)}
            what="Decision model that picks responders in Auto rooms."
            href="https://typesafe.ai"
          />
        </ul>
      </section>

      <section className="mt-7">
        <h3 className="text-[12.5px] font-medium text-mute">Local Data Footprint</h3>
        <p className="mt-1 text-[13px] text-mute">
          Bots, chats and each bot&apos;s <code className="rounded-md bg-raised-2 px-1 font-mono text-[12px]">MEMORY.md</code> are stored locally in:
        </p>
        <p className="mt-2 rounded-2xl bg-raised px-4 py-3 font-mono text-[12px] break-all text-mute">{status?.dataDir}</p>
      </section>
    </Drawer>
  );
}
