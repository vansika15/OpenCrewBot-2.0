import { createClient } from "@libsql/client";
import * as store from "../src/lib/server/db";
import { sendMessage } from "../src/lib/server/service";
import { taskEngine } from "../src/lib/server/tasks/engine";
import { workflowEngine } from "../src/lib/server/scheduler/workflow-engine";

async function verify() {
  console.log("=== VERIFYING DEDUPLICATION FIXES ===");

  // 1. Verify listMessages for Atlas (dm:971e6f87) has no duplicates
  const atlasMessages = await store.listMessages("dm:971e6f87" as any);
  console.log(`Atlas messages count: ${atlasMessages.length}`);
  for (let i = 1; i < atlasMessages.length; i++) {
    const prev = atlasMessages[i - 1];
    const curr = atlasMessages[i];
    const prevText = prev.parts.find((p) => p.kind === "text")?.text;
    const currText = curr.parts.find((p) => p.kind === "text")?.text;
    if (prevText && prevText === currText && prev.role === curr.role) {
      throw new Error(`Found consecutive duplicate in Atlas: "${currText?.slice(0, 50)}"`);
    }
  }
  console.log("PASS: Atlas has no duplicate messages.");

  // 2. Verify listMessages for Scout (dm:66e3b7a1) with deduplication applied
  const scoutMessages = await store.listMessages("dm:66e3b7a1" as any);
  console.log(`Scout deduplicated messages count: ${scoutMessages.length}`);
  // Check no consecutive identical messages
  for (let i = 1; i < scoutMessages.length; i++) {
    const prev = scoutMessages[i - 1];
    const curr = scoutMessages[i];
    const prevText = prev.parts.find((p) => p.kind === "text")?.text;
    const currText = curr.parts.find((p) => p.kind === "text")?.text;
    if (prevText && prevText === currText && prev.role === curr.role) {
      throw new Error(`Found consecutive duplicate in Scout: "${currText?.slice(0, 50)}"`);
    }
  }
  console.log("PASS: Scout messages have no consecutive identical duplicates.");

  // 3. Test sending a message and rapid duplicate prevention
  const bots = await store.listBots();
  const atlasBot = bots.find((b) => b.name.toLowerCase() === "atlas") || bots[0];
  const convId = `dm:${atlasBot.id}` as any;

  console.log(`Testing message sending in ${convId}...`);
  const initialCount = (await store.listMessages(convId)).length;

  const msg1 = await sendMessage(convId, "Testing deduplication verification message");
  const msg2 = await sendMessage(convId, "Testing deduplication verification message"); // rapid duplicate

  console.log(`msg1 ID: ${msg1.id}, msg2 ID: ${msg2.id}`);
  if (msg1.id !== msg2.id) {
    throw new Error(`Expected rapid duplicate to return existing message ID, got ${msg1.id} and ${msg2.id}`);
  }
  console.log("PASS: Rapid duplicate user submission was de-duplicated to same message ID.");

  // 4. Verify taskEngine execution no longer writes into dm:*
  console.log("Testing Task Engine execution isolation...");
  const beforeTaskCount = (await store.listMessages(convId)).length;
  const plan = await taskEngine.createPlan("Verify isolation", convId, [
    {
      title: "Isolated Subtask",
      description: "Subtask to verify execution conversation isolation",
      assignedAgentId: atlasBot.id,
      dependencies: [],
      priority: "medium",
      input: { text: "Verify" },
      requiresApproval: false,
    },
  ]);

  await taskEngine.executePlan(plan.id);

  const afterTaskCount = (await store.listMessages(convId)).length;
  console.log(`Messages in ${convId} before task: ${beforeTaskCount}, after task: ${afterTaskCount}`);
  if (beforeTaskCount !== afterTaskCount) {
    throw new Error(`Task execution polluted ${convId}! Messages increased from ${beforeTaskCount} to ${afterTaskCount}`);
  }
  console.log("PASS: Task execution did not pollute user DM conversation!");

  // Clean up the test user message from convId
  await (await store.db()).execute({ sql: "DELETE FROM messages WHERE id = ?", args: [msg1.id] });
  console.log("Cleaned up test message.");

  console.log("\nALL DEDUPLICATION TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}

verify().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
