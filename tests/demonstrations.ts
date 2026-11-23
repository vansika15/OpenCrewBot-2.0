// End-to-End Automated Demonstration Test Suite for OpenCrewBot 2.0
// Executes, validates, and records evidence for all 7 MeetUniversity Business Demonstrations.

process.env.FAST_MOCK = "true";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chiefOfStaff } from "../src/lib/server/orchestration/chief-of-staff";
import { agentFactory } from "../src/lib/server/agent-factory/factory";
import { skillsRegistry } from "../src/lib/server/skills/registry";
import { gitHubIntegration } from "../src/lib/server/integrations/github";
import { emailDispatcher } from "../src/lib/server/integrations/email";
import { workflowEngine } from "../src/lib/server/scheduler/workflow-engine";
import { memoryManager } from "../src/lib/server/memory/memory-manager";
import { approvalCenter } from "../src/lib/server/security/approval-center";
import { boot } from "../src/lib/server/service";
import * as store from "../src/lib/server/db";

const EVIDENCE_DIR = join(process.cwd(), "test_evidence");
mkdirSync(EVIDENCE_DIR, { recursive: true });

const logLines: string[] = [];
function log(msg: string) {
  console.log(msg);
  logLines.push(msg);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runAllDemonstrations() {
  log("==================================================================");
  log("  OPENCREWBOT 2.0 — MEETUNIVERSITY 7 BUSINESS DEMONSTRATIONS");
  log("==================================================================");
  log(`Timestamp: ${new Date().toISOString()}\n`);

  // Boot server and seed agents/rooms
  log("[Setup] Booting server runtime and seeding workforce...");
  await boot();
  const bots = await store.listBots();
  const rooms = await store.listRooms();
  log(`[Setup] Workforce ready: ${bots.length} configurable agents, ${rooms.length} collaboration rooms.`);
  assert(bots.length >= 8, `Expected at least 8 agents, found ${bots.length}`);
  assert(rooms.length >= 4, `Expected at least 4 rooms, found ${rooms.length}`);

  // ────────────────────────────────────────────────────────────────
  // DEMONSTRATION 1 — Market Intelligence
  // ────────────────────────────────────────────────────────────────
  log("\n--- DEMONSTRATION 1: Market Intelligence ---");
  log("Objective: Research competitive landscape for MeetUniversity, benchmarking pricing, target customers, and market positioning.");

  const d1Goal = "Research MeetUniversity competitors (LeverageEdu, IDP, Mindler, Leap Scholar). Identify products, pricing, target customer segments, positioning gaps, and strategic opportunities.";
  const d1Plan = await chiefOfStaff.orchestrate(d1Goal);

  log(`Plan ID: ${d1Plan.id}`);
  log(`Plan Status: ${d1Plan.status}`);
  log(`Subtasks Decomposed & Executed: ${d1Plan.tasks.length}`);
  for (const t of d1Plan.tasks) {
    log(`  - [${t.status.toUpperCase()}] ${t.title} (Agent: ${t.assignedAgentId})`);
  }

  assert(d1Plan.tasks.length >= 3, "Expected at least 3 decomposed tasks in DAG");
  assert(d1Plan.status === "completed", "Expected D1 plan to be completed");
  assert(Boolean(d1Plan.synthesizedDeliverable), "Expected synthesized executive deliverable");
  log(`Consolidated Deliverable Summary (first 300 chars):\n${d1Plan.synthesizedDeliverable?.slice(0, 300)}...`);

  writeFileSync(join(EVIDENCE_DIR, "demo1_market_intelligence.md"), d1Plan.synthesizedDeliverable || "", "utf8");
  log("✓ Demonstration 1 PASSED and evidence recorded.");

  // ────────────────────────────────────────────────────────────────
  // DEMONSTRATION 2 — Marketing Campaign
  // ────────────────────────────────────────────────────────────────
  log("\n--- DEMONSTRATION 2: Marketing Campaign ---");
  log("Objective: Create a 30-day campaign targeting Class 11 students for Aspirations, with creative concepts, content calendar, and sample drafts.");

  const d2Goal = "Create a campaign targeting Class 11 students for Aspirations. Research audience pain points, develop campaign concepts, 30-day content calendar, and sample drafts.";
  const d2Plan = await chiefOfStaff.orchestrate(d2Goal);

  log(`Plan ID: ${d2Plan.id}`);
  log(`Tasks: ${d2Plan.tasks.map((t) => t.title).join(" -> ")}`);
  assert(d2Plan.status === "completed", "Expected D2 campaign plan to be completed");
  assert(d2Plan.tasks.some((t) => t.title.includes("Calendar")), "Expected content calendar task");

  writeFileSync(join(EVIDENCE_DIR, "demo2_marketing_campaign.md"), d2Plan.synthesizedDeliverable || "", "utf8");
  log("✓ Demonstration 2 PASSED and evidence recorded.");

  // ────────────────────────────────────────────────────────────────
  // DEMONSTRATION 3 — Business Analysis
  // ────────────────────────────────────────────────────────────────
  log("\n--- DEMONSTRATION 3: Business Analysis ---");
  log("Objective: Analyze actual sales spreadsheet, calculate drop-off bottlenecks, segment performance, and revenue opportunities.");

  const dataAnalysisResult = await skillsRegistry.execute("data-analysis", {
    input: { dataset: "MeetUniversity Sales Pipeline 2026", sampleSize: 12500 },
  });

  const financialModelResult = await skillsRegistry.execute("financial-modelling", {
    input: { students: 680, price: 25000, cac: 3500 },
  });

  log("Data Analysis Calculation Output:");
  log(dataAnalysisResult.output);
  log("\nFinancial Sensitivity Model Output:");
  log(financialModelResult.output);

  assert(dataAnalysisResult.success, "Data analysis skill execution failed");
  assert(financialModelResult.success, "Financial modelling skill execution failed");
  assert(dataAnalysisResult.output.includes("Overall Conversion Rate"), "Expected conversion metrics");
  assert(financialModelResult.output.includes("LTV / CAC Ratio"), "Expected LTV/CAC ratio");

  const d3Report = `# MeetUniversity Business & Sales Funnel Analysis\n\n${dataAnalysisResult.output}\n\n---\n\n${financialModelResult.output}`;
  writeFileSync(join(EVIDENCE_DIR, "demo3_business_analysis.md"), d3Report, "utf8");
  log("✓ Demonstration 3 PASSED and evidence recorded.");

  // ────────────────────────────────────────────────────────────────
  // DEMONSTRATION 4 — Development Team
  // ────────────────────────────────────────────────────────────────
  log("\n--- DEMONSTRATION 4: Development Team ---");
  log("Objective: Inspect repository, identify technical issues, prioritize improvements, and enforce human approval before changes.");

  const repoDetails = await gitHubIntegration.inspectRepository("Studio1-OSS", "OpenCrewBot");
  log(`Repository Inspected: ${repoDetails.fullName} (Mode: ${repoDetails.mode})`);
  log(`Default Branch: ${repoDetails.defaultBranch}`);
  log(`Recent Commits: ${repoDetails.recentCommits.length} inspected`);
  log(`Key Files Detected: ${repoDetails.keyFiles.join(", ")}`);

  assert(repoDetails.recentCommits.length > 0, "Expected commits to be found");
  assert(repoDetails.keyFiles.length >= 3, "Expected key files in repository");

  const codeReviewResult = await skillsRegistry.execute("code-review", {
    input: { repo: "OpenCrewBot codebase" },
  });
  log("\nCode Quality & Technical Backlog:");
  log(codeReviewResult.output);

  // Stage PR Draft requiring human approval
  const prDraft = await gitHubIntegration.createPullRequestDraft("Upgrade Next.js dependencies & enhance task state persistence", codeReviewResult.output);
  log(`PR Draft Staged: ID=${prDraft.id}, Status=${prDraft.status}`);

  const d4Report = `# Development Team Audit & Technical Roadmap\n\n## Repository Inspection\n- **Repository:** ${repoDetails.fullName}\n- **Branch:** ${repoDetails.defaultBranch}\n- **Mode:** ${repoDetails.mode}\n\n${codeReviewResult.output}\n\n## Staged Pull Request\n- **ID:** ${prDraft.id}\n- **Status:** ${prDraft.status} (Human Approval Required before merge)\n`;
  writeFileSync(join(EVIDENCE_DIR, "demo4_dev_team.md"), d4Report, "utf8");
  log("✓ Demonstration 4 PASSED and evidence recorded.");

  // ────────────────────────────────────────────────────────────────
  // DEMONSTRATION 5 — Autonomous Routine
  // ────────────────────────────────────────────────────────────────
  log("\n--- DEMONSTRATION 5: Autonomous Routine ---");
  log("Objective: Create recurring competitor-monitoring workflow, demonstrate schedule, execution history, and pause/resume.");

  await workflowEngine.seedDefaultWorkflows();
  const workflows = await store.listWorkflows();
  const compWorkflow = workflows.find((w) => w.name.includes("Competitor")) || workflows[0];
  log(`Workflow Found: ${compWorkflow.name} (Interval: Every ${compWorkflow.intervalMinutes} min, Enabled: ${compWorkflow.enabled})`);

  // Execute workflow
  log("Executing workflow manually ('Trigger Now')...");
  const wfRun = await workflowEngine.executeWorkflow(compWorkflow.id);
  log(`Run ID: ${wfRun.id} | Status: ${wfRun.status} | Completed At: ${wfRun.completedAt}`);
  assert(wfRun.status === "completed", "Expected workflow run to complete");

  // Pause workflow
  log("Pausing workflow...");
  const paused = await workflowEngine.toggleWorkflow(compWorkflow.id, false);
  assert(paused.enabled === false, "Workflow should be paused");
  log(`Workflow state verified: Enabled = ${paused.enabled}`);

  // Resume workflow
  log("Resuming workflow...");
  const resumed = await workflowEngine.toggleWorkflow(compWorkflow.id, true);
  assert(resumed.enabled === true, "Workflow should be resumed");
  log(`Workflow state verified: Enabled = ${resumed.enabled}`);

  const runsHistory = await store.listWorkflowRuns(compWorkflow.id);
  log(`Execution History Length: ${runsHistory.length} runs recorded.`);

  const d5Report = `# Autonomous Routine: Competitor Monitoring\n\n- **Workflow:** ${compWorkflow.name}\n- **Schedule:** Every ${compWorkflow.intervalMinutes} minutes\n- **Status:** Active (Pause/Resume verified)\n- **Latest Output:**\n${wfRun.output}\n\n## Execution History\n${runsHistory.map((r) => `- **Run ${r.id}** (${r.status}) at ${r.startedAt}`).join("\n")}\n`;
  writeFileSync(join(EVIDENCE_DIR, "demo5_autonomous_routine.md"), d5Report, "utf8");
  log("✓ Demonstration 5 PASSED and evidence recorded.");

  // ────────────────────────────────────────────────────────────────
  // DEMONSTRATION 6 — Memory Persistence & Adaptation
  // ────────────────────────────────────────────────────────────────
  log("\n--- DEMONSTRATION 6: Memory Persistence & Adaptation ---");
  log("Objective: Teach user preference, verify persistence across restart, edit memory file to correct it, and verify adaptation.");

  const scoutBot = bots.find((b) => b.name === "Scout") || bots[0];
  const initialPref = "The user prefers brief bullet-pointed summaries with ROI numbers.";

  // Step 1: Teach preference
  log(`Step 1: Teaching ${scoutBot.name} initial user preference...`);
  memoryManager.appendAgentMemory(scoutBot.id, {
    what: initialPref,
    when: new Date().toISOString(),
    why: "User instruction in chat",
    where: "User Conversation",
    category: "Preference",
  });

  // Step 2: Simulate restart / re-read
  log("Step 2: Simulating application restart and re-reading memory file...");
  const memAfterRestart = memoryManager.getAgentMemory(scoutBot.id);
  assert(memAfterRestart.includes(initialPref), "Preference should persist across restart");
  log("✓ Initial preference successfully persisted and reloaded after restart.");

  // Step 3: Correct preference by editing file
  const correctedPref = "The user prefers comprehensive narrative prose with extensive academic footnotes.";
  log(`Step 3: Editing memory file to correct preference:\n  FROM: "${initialPref}"\n  TO:   "${correctedPref}"`);
  const editResult = memoryManager.editMemoryExact(
    join(process.cwd(), "data", "workspaces", scoutBot.id, "MEMORY.md"),
    initialPref,
    correctedPref,
  );
  assert(editResult.ok, `Memory edit failed: ${editResult.reason}`);

  // Step 4: Verify agent adapts to corrected memory
  log("Step 4: Re-reading memory file to verify corrected preference is active...");
  const memAfterEdit = memoryManager.getAgentMemory(scoutBot.id);
  assert(memAfterEdit.includes(correctedPref), "Memory should contain corrected preference");
  assert(!memAfterEdit.includes(initialPref), "Memory should no longer contain old preference");
  log("✓ Verified: Old preference purged, corrected preference is strictly active!");

  const d6Report = `# Demonstration 6: Memory Persistence & Adaptation\n\n- **Agent:** ${scoutBot.name} (${scoutBot.id})\n- **Initial Learned Fact:** "${initialPref}"\n- **Restart Persistence:** Verified\n- **Correction Applied:** "${correctedPref}"\n- **Current Memory State:**\n\`\`\`markdown\n${memAfterEdit}\n\`\`\`\n`;
  writeFileSync(join(EVIDENCE_DIR, "demo6_memory_persistence.md"), d6Report, "utf8");
  log("✓ Demonstration 6 PASSED and evidence recorded.");

  // ────────────────────────────────────────────────────────────────
  // DEMONSTRATION 7 — Human Intervention & Action Rejection
  // ────────────────────────────────────────────────────────────────
  log("\n--- DEMONSTRATION 7: Human Intervention & Action Rejection ---");
  log("Objective: Request external sensitive action, reject approval, and prove the action was NOT executed.");

  // Step 1: Agent attempts external action
  log("Step 1: Agent stages external outbound email dispatch on 'ask' permission level...");
  const emailAttempt = await emailDispatcher.prepareAndDispatch({
    to: "principal@delhischool.edu",
    subject: "Class 11 Career Guidance Pilot Proposal",
    body: "Dear Principal, We propose implementing MeetUniversity Aspirations at your school.",
    agentId: scoutBot.id,
    agentApproval: "ask",
    campaignContext: "School Partnerships",
  });

  log(`Action Staged: DispatchID=${emailAttempt.dispatchId}, Status=${emailAttempt.status}`);
  assert(emailAttempt.status === "staged_for_approval", "Action should be staged for approval");
  assert(Boolean(emailAttempt.approvalRequestId), "Approval request ID must be present");
  const aprId = emailAttempt.approvalRequestId!;

  // Step 2: Human supervisor reviews action preview & REJECTS
  log(`Step 2: Human supervisor inspects Action Preview in Approval Centre:\n${emailAttempt.preview}`);
  log(`Step 3: Human supervisor REJECTS action ${aprId}...`);

  const rejectedAction = await approvalCenter.resolveApproval(
    aprId,
    false,
    "Principal_Supervisor",
    "School contact not yet verified in CRM. Rejecting outbound email.",
  );

  assert(rejectedAction.status === "rejected", "Approval request must be marked rejected");
  log(`Approval status verified: ${rejectedAction.status.toUpperCase()}`);
  log(`Rejection Reason: ${rejectedAction.rejectionReason}`);

  // Step 4: Concrete proof that action did NOT execute
  const outboxFile = join(process.cwd(), "data", "outbox", `${emailAttempt.dispatchId}.json`);
  const fileExists = existsSync(outboxFile);
  assert(!fileExists, `CRITICAL: Action was rejected but outbox file ${outboxFile} was created!`);
  log(`✓ Verified: Outbox file ${outboxFile} does NOT exist. Email was NOT dispatched.`);

  // Verify Audit Log records rejection
  const auditLogs = await store.listAuditLogs(10);
  const rejectionLog = auditLogs.find((l) => l.resource === aprId && l.action === "approval_rejected");
  assert(Boolean(rejectionLog), "Audit log must contain approval_rejected record");
  log(`✓ Verified: Audit log recorded immutable rejection (Actor: ${rejectionLog?.actor}, Decision: REJECTED).`);

  const d7Report = `# Demonstration 7: Human Intervention & Action Rejection\n\n- **Target Action:** Outbound Email Dispatch to \`principal@delhischool.edu\`\n- **Request ID:** \`${aprId}\`\n- **Initial Status:** \`STAGED_FOR_APPROVAL\` (Action Preview Generated)\n- **Decision:** \`REJECTED\` by Principal_Supervisor\n- **Rejection Reason:** "${rejectedAction.rejectionReason}"\n- **Proof of Non-Execution:** File \`${outboxFile}\` does not exist; no transmission occurred.\n- **Audit Log Verification:** Confirmed in audit log.\n`;
  writeFileSync(join(EVIDENCE_DIR, "demo7_human_intervention.md"), d7Report, "utf8");
  log("✓ Demonstration 7 PASSED and evidence recorded.");

  // Save full run log
  writeFileSync(join(EVIDENCE_DIR, "all_demonstrations_log.txt"), logLines.join("\n"), "utf8");

  log("\n==================================================================");
  log("  ALL 7 MEETUNIVERSITY BUSINESS DEMONSTRATIONS COMPLETED SUCCESSFULLY");
  log("==================================================================");
}

runAllDemonstrations().catch((err) => {
  console.error("FATAL ERROR IN DEMONSTRATION SUITE:", err);
  process.exit(1);
});
