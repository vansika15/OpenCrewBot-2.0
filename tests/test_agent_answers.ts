import * as store from "../src/lib/server/db";
import { runTurn } from "../src/lib/server/runtime";

async function runTests() {
  console.log("==================================================================");
  console.log("  TESTING ATLAS, SCOUT & QUILL WITH GENUINE OLLAMA INFERENCE");
  console.log("==================================================================");

  const bots = await store.listBots();
  const atlas = bots.find((b) => b.name === "Atlas");
  const scout = bots.find((b) => b.name === "Scout");
  const quill = bots.find((b) => b.name === "Quill");

  if (!atlas || !scout || !quill) {
    throw new Error("Could not find Atlas, Scout, or Quill in bots list");
  }

  const atlasQuestions = [
    { q: "What is OpenCrewBot?", label: "Atlas Q1: What is OpenCrewBot?" },
    { q: "Explain what React is.", label: "Atlas Q2: Explain what React is" },
    { q: "How does a REST API work?", label: "Atlas Q3: How does a REST API work?" },
    { q: "What is the role of an AI Chief of Staff?", label: "Atlas Q4: Role of AI Chief of Staff" },
  ];

  console.log("\n--- PART 1: TESTING ATLAS (Chief of Staff & Software Capability) ---");
  for (const item of atlasQuestions) {
    console.log(`\nTesting: ${item.label}`);
    console.log(`Prompt: "${item.q}"`);
    const start = Date.now();
    const reply = await runTurn({
      bot: atlas,
      conversationId: `task-exec:test-atlas-verify:${Date.now()}`,
      content: `${item.q} (Provide a direct, concise 2-3 sentence answer)`,
    });
    const duration = Date.now() - start;
    const text = reply?.parts?.filter((p) => p.kind === "text").map((p: any) => p.text).join("\n") || "";
    console.log(`Status: ${reply?.status} | Duration: ${duration}ms | Model: ${reply?.model}`);
    console.log(`Response:\n${text.trim()}\n`);

    if (text.toLowerCase().includes("unable to provide information about apps")) {
      throw new Error(`Atlas still returned the refusal for: ${item.q}`);
    }
    if (!text.trim() || reply?.status !== "done") {
      throw new Error(`Atlas failed to provide a valid response for: ${item.q}`);
    }
  }

  console.log("\n--- PART 2: TESTING SCOUT (Research & Sourced Analysis) ---");
  const scoutPrompt = "What are the primary factors to evaluate when choosing a study abroad destination?";
  console.log(`Testing Scout with prompt: "${scoutPrompt}"`);
  const scoutStart = Date.now();
  const scoutReply = await runTurn({
    bot: scout,
    conversationId: `task-exec:test-scout-verify:${Date.now()}`,
    content: `${scoutPrompt} (Provide a direct, concise 2-sentence summary)`,
  });
  const scoutDuration = Date.now() - scoutStart;
  const scoutText = scoutReply?.parts?.filter((p) => p.kind === "text").map((p: any) => p.text).join("\n") || "";
  console.log(`Status: ${scoutReply?.status} | Duration: ${scoutDuration}ms | Model: ${scoutReply?.model}`);
  console.log(`Response:\n${scoutText.trim()}\n`);
  if (!scoutText.trim() || scoutReply?.status !== "done") {
    throw new Error("Scout failed to provide a valid response");
  }

  console.log("\n--- PART 3: TESTING QUILL (Writing & Content Creation) ---");
  const quillPrompt = "Write a short 2-sentence motivational welcome message for student applicants.";
  console.log(`Testing Quill with prompt: "${quillPrompt}"`);
  const quillStart = Date.now();
  const quillReply = await runTurn({
    bot: quill,
    conversationId: `task-exec:test-quill-verify:${Date.now()}`,
    content: `${quillPrompt}`,
  });
  const quillDuration = Date.now() - quillStart;
  const quillText = quillReply?.parts?.filter((p) => p.kind === "text").map((p: any) => p.text).join("\n") || "";
  console.log(`Status: ${quillReply?.status} | Duration: ${quillDuration}ms | Model: ${quillReply?.model}`);
  console.log(`Response:\n${quillText.trim()}\n`);
  if (!quillText.trim() || quillReply?.status !== "done") {
    throw new Error("Quill failed to provide a valid response");
  }

  console.log("==================================================================");
  console.log("  ALL TESTS PASSED: ATLAS, SCOUT & QUILL RESPONDING MEANINGFULLY");
  console.log("==================================================================");
}

runTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
