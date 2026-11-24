// Verification of failure mode when Ollama is stopped
// Strict maximum execution time: 20 seconds
import { boot } from "../src/lib/server/service";
import * as store from "../src/lib/server/db";
import { runTurn } from "../src/lib/server/runtime";

async function runFailureModeTest() {
  console.log("==================================================================");
  console.log("  OLLAMA FAILURE-MODE TEST (STOPPED PROVIDER CHECK)");
  console.log("  Strict Timeout: 20 seconds");
  console.log("==================================================================");

  const start = Date.now();

  // Strict 20s watchdog
  const watchdog = setTimeout(() => {
    console.error("[Watchdog] Strict 20s timeout reached! Terminating.");
    process.exit(1);
  }, 20000);
  if (watchdog.unref) watchdog.unref();

  await boot();
  const bots = await store.listBots();
  const scout = bots.find((b) => b.name === "Scout")!;
  console.log(`[Test] Target Agent: ${scout.name} (${scout.id})`);
  console.log(`[Test] Dispatching turn while Ollama service is stopped...`);

  const reply = await runTurn({
    bot: scout,
    conversationId: `dm:${scout.id}`,
    content: "Explain MeetUniversity aspirations and partner services.",
  });

  const durationMs = Date.now() - start;
  console.log(`[Test] Completed in: ${durationMs}ms`);
  console.log(`[Test] Status: ${reply?.status}`);
  console.log(`[Test] Error Message: ${reply?.error || "NONE"}`);
  console.log(`[Test] Parts Count: ${reply?.parts.length ?? 0}`);

  const hasFakeText = (reply?.parts ?? []).some((p) => p.kind === "text" && p.text.trim().length > 0);
  console.log(`[Test] Fake Scripted Text Generated?: ${hasFakeText}`);

  if (reply?.status === "error" && !hasFakeText && reply?.error?.includes("ECONNREFUSED")) {
    console.log("\n>>> SUCCESS: System cleanly reported provider-unavailable error without faking AI output. <<<");
    process.exit(0);
  } else {
    console.error("\n>>> FAILURE: System did not handle offline provider as expected. <<<");
    process.exit(1);
  }
}

runFailureModeTest().catch((err) => {
  console.error("[Test] Execution error:", err);
  process.exit(1);
});
