import { runTurn } from "../src/lib/server/runtime";
import * as store from "../src/lib/server/db";
import { multiModelRouter } from "../src/lib/server/llm/provider-router";

async function runPhase2() {
  console.log("==================================================================");
  console.log("  PHASE 2 — LOCAL AI INFERENCE AUDIT (OLLAMA & 3 AGENTS)");
  console.log("==================================================================");

  // 1. Check Ollama API
  const health = await multiModelRouter.checkOllamaHealth();
  console.log("[Health Check] Provider:", health.provider);
  console.log("[Health Check] Healthy:", health.healthy);
  console.log("[Health Check] Base URL:", health.baseUrl);
  console.log("[Health Check] Installed Models:", health.models);
  console.log("[Health Check] Active Model:", health.activeModel);
  console.log("[Health Check] Latency:", health.latencyMs, "ms");

  if (!health.healthy) {
    throw new Error(`Ollama health check failed: ${health.error}`);
  }
  if (!health.models.includes("qwen2.5:0.5b")) {
    throw new Error("Model qwen2.5:0.5b not found in Ollama installed models");
  }

  // 2. Fetch agents
  const bots = await store.listBots();
  const scout = bots.find((b) => b.name === "Scout")!;
  const atlas = bots.find((b) => b.name === "Atlas")!;
  const quill = bots.find((b) => b.name === "Quill")!;

  const testAgents = [
    { bot: scout, prompt: "What is MeetUniversity's core market mission? (Max 15 words)" },
    { bot: atlas, prompt: "What is your primary duty as Chief of Staff? (Max 15 words)" },
    { bot: quill, prompt: "Write a one-sentence tagline for student aspirants." },
  ];

  const results: any[] = [];

  for (const { bot, prompt } of testAgents) {
    console.log(`\n--- Testing Agent: ${bot.name} (${bot.id}) ---`);
    console.log(`Prompt: "${prompt}"`);
    const startTime = Date.now();

    const reply = await runTurn({
      bot,
      conversationId: `task-exec:phase2-audit:${bot.id}`,
      content: prompt,
    });

    const duration = Date.now() - startTime;
    const text = reply?.parts?.map((p: any) => p.text).filter(Boolean).join("\n") || "";
    const isMock = text.includes("[MOCK]") || reply?.model === "mock";

    console.log(`Status: ${reply?.status}`);
    console.log(`Model: ${reply?.model}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Is Mock: ${isMock}`);
    console.log(`Output: "${text.trim()}"`);

    if (reply?.status !== "done" || isMock || !text.trim()) {
      throw new Error(`Inference verification failed for agent ${bot.name}`);
    }

    results.push({
      agent: bot.name,
      id: bot.id,
      model: reply.model,
      status: reply.status,
      durationMs: duration,
      output: text.trim(),
    });
  }

  console.log("\n==================================================================");
  console.log("  PHASE 2 SUMMARY: ALL 3 AGENTS PASSED REAL OLLAMA INFERENCE");
  console.log("==================================================================");
  console.log(JSON.stringify(results, null, 2));

  process.exit(0);
}

runPhase2().catch((err) => {
  console.error("Phase 2 Audit Failed:", err);
  process.exit(1);
});
