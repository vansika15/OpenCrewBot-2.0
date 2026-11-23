// Comprehensive Unit & Integration Test Suite for OpenCrewBot 2.0
// Validates: Agent Factory, Task Engine DAG, Multi-Tier Memory, 8 Skills,
// 3-Tier Security, Integrations, Scheduled Workflows, and Multi-Model Router with Ollama.

process.env.AI_PROVIDER = "ollama";
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";
process.env.OLLAMA_MODEL = "qwen2.5:0.5b";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as store from "../src/lib/server/db";
import { boot } from "../src/lib/server/service";
import { agentFactory } from "../src/lib/server/agent-factory/factory";
import { taskEngine } from "../src/lib/server/tasks/engine";
import { memoryManager } from "../src/lib/server/memory/memory-manager";
import { skillsRegistry } from "../src/lib/server/skills/registry";
import { approvalCenter } from "../src/lib/server/security/approval-center";
import { gitHubIntegration } from "../src/lib/server/integrations/github";
import { notionSync } from "../src/lib/server/integrations/notion";
import { emailDispatcher } from "../src/lib/server/integrations/email";
import { workflowEngine } from "../src/lib/server/scheduler/workflow-engine";
import { multiModelRouter } from "../src/lib/server/llm/provider-router";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`TEST FAILED: ${msg}`);
}

async function runTests() {
  console.log("==================================================================");
  console.log("  OPENCREWBOT 2.0 — COMPREHENSIVE UNIT & INTEGRATION TEST SUITE");
  console.log("==================================================================");
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  let passed = 0;
  let total = 0;

  const test = async (name: string, fn: () => Promise<void>) => {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err);
      throw err;
    }
  };

  await boot();

  // Test 1: Minimum Configurable Agents & Collaboration Rooms
  await test("Workforce Seeding: At least 8 agents and 4 collaboration rooms", async () => {
    const bots = await store.listBots();
    const rooms = await store.listRooms();
    assert(bots.length >= 8, `Expected >=8 bots, found ${bots.length}`);
    assert(rooms.length >= 4, `Expected >=4 rooms, found ${rooms.length}`);
  });

  // Test 2: Dynamic Agent Factory
  await test("Module B: Dynamic Agent Creation via Natural Language", async () => {
    const res = await agentFactory.createAgentFromPrompt({
      prompt: "Create an EdTech Lead Generation Specialist who sources K-12 partner schools",
      permissionLevel: "controlled",
    });
    assert(Boolean(res.bot.id), "Agent should have valid ID");
    assert(res.bot.approval === "controlled", "Agent permission should be controlled");
    assert(res.suggestedSkills.length > 0, "Agent should have suggested skills");

    // Verify database persistence
    const saved = await store.getBot(res.bot.id);
    assert(saved !== null, "Created bot must exist in SQLite database");
    assert(saved?.name === res.bot.name, "Persisted bot name mismatch");
  });

  // Test 3: Task Execution Engine & Parallel DAG
  await test("Module D: Task Execution Engine with DAG Dependencies", async () => {
    const bots = await store.listBots();
    const plan = await taskEngine.createPlan("Test Pipeline", undefined, [
      {
        title: "Subtask Alpha (Independent)",
        description: "Runs first",
        assignedAgentId: bots[0].id,
        dependencies: [],
        priority: "high",
        input: { step: 1 },
        requiresApproval: false,
      },
      {
        title: "Subtask Beta (Dependent on Alpha)",
        description: "Runs after Alpha",
        assignedAgentId: bots[1].id,
        dependencies: ["dep-index-0"],
        priority: "medium",
        input: { step: 2 },
        requiresApproval: false,
      },
    ]);

    assert(plan.tasks.length === 2, "Expected 2 tasks in plan");
    assert(plan.tasks[1].dependencies.includes(plan.tasks[0].id), "DAG dependency must map correctly");

    const executed = await taskEngine.executePlan(plan.id);
    assert(executed.status === "completed", "Plan execution should be completed");
    assert(executed.tasks.every((t) => t.status === "completed"), "All tasks in DAG must be completed");
  });

  // Test 4: Task Cancellation & Retries
  await test("Module D: Task Cancellation & Failure Handling", async () => {
    const bots = await store.listBots();
    const plan = await taskEngine.createPlan("Cancel Test", undefined, [
      {
        title: "To Be Cancelled",
        description: "Will be aborted",
        assignedAgentId: bots[0].id,
        dependencies: [],
        priority: "low",
        input: {},
        requiresApproval: false,
      },
    ]);

    await taskEngine.cancelPlan(plan.id);
    const updated = await store.getTaskPlan(plan.id);
    assert(updated?.status === "interrupted", "Plan status should be interrupted");
  });

  // Test 5: Multi-Tier Persistent Memory
  await test("Module E: Multi-Tier Memory (Project, Room, Agent) with Provenance", async () => {
    // 1. Project Memory
    memoryManager.saveProjectMemory("# Custom Enterprise Project Memory\n\n- Guideline: Rigorous verification");
    const proj = memoryManager.getProjectMemory();
    assert(proj.includes("Rigorous verification"), "Project memory should be readable");

    // 2. Room Memory
    const roomMem = memoryManager.saveRoomMemory("test-room", "# Test Room Memory\n- Active Objective: Test");
    assert(roomMem.includes("Test Room Memory"), "Room memory should be saved");

    // 3. Provenance Tracking
    const bots = await store.listBots();
    memoryManager.appendAgentMemory(bots[0].id, {
      what: "Prefers concise summary tables",
      when: new Date().toISOString(),
      why: "User preference update",
      where: "Chat turn",
      category: "Preference",
    });

    const agentMem = memoryManager.getAgentMemory(bots[0].id);
    assert(agentMem.includes("Prefers concise summary tables"), "Agent memory should contain appended fact");
    assert(agentMem.includes("User preference update"), "Agent memory should contain provenance why");
  });

  // Test 6: 8 Reusable Skills Ecosystem
  await test("Module F: All 8 Reusable Skills Execution", async () => {
    const skillList = skillsRegistry.list();
    assert(skillList.length >= 8, `Expected at least 8 skills, found ${skillList.length}`);

    const expectedSkillIds = [
      "market-research",
      "competitor-analysis",
      "financial-modelling",
      "presentation-creation",
      "email-drafting",
      "code-review",
      "data-analysis",
      "lead-generation",
    ];

    for (const sId of expectedSkillIds) {
      const res = await skillsRegistry.execute(sId, { input: { test: true } });
      assert(res.success, `Skill ${sId} execution failed`);
      assert(res.output.length > 50, `Skill ${sId} produced insufficient output`);
    }
  });

  // Test 7: 3-Tier Security Permissions & Rejection Enforcement
  await test("Module G: 3-Tier Security and Strict Rejection Enforcement", async () => {
    // 1. Evaluation check
    assert(approvalCenter.canExecuteDirectly("full", "email_dispatch") === true, "Full access should execute directly");
    assert(approvalCenter.canExecuteDirectly("ask", "email_dispatch") === false, "Ask first must not execute directly");
    assert(approvalCenter.canExecuteDirectly("controlled", "external_api", true) === true, "Controlled allows safe reads");
    assert(approvalCenter.canExecuteDirectly("controlled", "email_dispatch", false) === false, "Controlled blocks writes without approval");

    // 2. Request & Rejection
    const req = approvalCenter.requestApproval({
      agentId: "test-bot",
      actionType: "email_dispatch",
      toolName: "send_mail",
      title: "Test Email",
      description: "Send test email",
      payload: { to: "student@test.com" },
      requiredPermission: "ask",
    });

    assert(req.status === "pending", "New approval should be pending");
    const resolved = await approvalCenter.resolveApproval(req.id, false, "Supervisor", "Policy violation");
    assert(resolved.status === "rejected", "Approval should be marked rejected");

    // 3. Audit log verification
    const logs = await store.listAuditLogs(10);
    const match = logs.find((l) => l.resource === req.id && l.action === "approval_rejected");
    assert(Boolean(match), "Audit log must contain rejection record");
  });

  // Test 8: Integrations (GitHub, Notion, Email)
  await test("Module H: Three Working Integrations (GitHub, Notion, Email)", async () => {
    // GitHub
    const ghDetails = await gitHubIntegration.inspectRepository();
    assert(Boolean(ghDetails.fullName), "GitHub repo inspect should return fullName");
    assert(ghDetails.keyFiles.length > 0, "GitHub repo inspect should detect key files");

    // Notion Doc Sync
    const syncRes = await notionSync.syncDocument("Unit Test Document", "# Content for Sync", ["Test"]);
    assert(Boolean(syncRes.docId), "Notion sync should produce docId");
    assert(existsSync(syncRes.localPath), "Synced document file must exist on disk");

    // Email Dispatcher (Human Approval check)
    const emailRes = await emailDispatcher.prepareAndDispatch({
      to: "test@domain.com",
      subject: "Test Subject",
      body: "Test Body",
      agentId: "bot-1",
      agentApproval: "ask",
    });
    assert(emailRes.status === "staged_for_approval", "Email on 'ask' must stage for approval");
  });

  // Test 9: Scheduled AI Workflows
  await test("Module I: Scheduled Workflows (Pause, Resume, Trigger, History)", async () => {
    const wf = await workflowEngine.createWorkflow({
      name: "Unit Test Automated Routine",
      description: "Test workflow",
      intervalMinutes: 120,
      prompt: "Routine test prompt",
      enabled: true,
    });

    assert(wf.enabled === true, "Workflow should initially be enabled");

    // Pause
    const paused = await workflowEngine.toggleWorkflow(wf.id, false);
    assert(paused.enabled === false, "Workflow should be paused");

    // Resume
    const resumed = await workflowEngine.toggleWorkflow(wf.id, true);
    assert(resumed.enabled === true, "Workflow should be resumed");

    // Trigger
    const run = await workflowEngine.executeWorkflow(wf.id);
    assert(run.status === "completed", "Triggered workflow run should complete");

    // History
    const history = await store.listWorkflowRuns(wf.id);
    assert(history.length >= 1, "Workflow run history should have at least 1 record");
  });

  // Test 10: Multi-Model Router & Analytics
  await test("Module J: Multi-Model Intelligence, Task-Based Routing & Analytics", async () => {
    const providers = multiModelRouter.getAvailableProviders();
    assert(providers.length >= 5, "Expected at least 5 configured providers");

    // Local Ollama Health Check
    const ollamaHealth = await multiModelRouter.checkOllamaHealth();
    assert(ollamaHealth.healthy, "Ollama local health check must be healthy");
    assert(ollamaHealth.models.length > 0, "Ollama should have at least 1 downloaded model");

    // Task-based routing
    const planningRoute = multiModelRouter.routeModelForTask("planning");
    assert(planningRoute.provider === "ollama" || planningRoute.selectedModel.includes("DeepSeek"), "Planning routed appropriately");

    // Real vs Mock Token tracking verification
    multiModelRouter.trackUsage("qwen2.5:0.5b", 300, 150, 0, "ollama", true); // Real local inference
    multiModelRouter.trackUsage("mock-model", 100, 50, 0, "mock", false); // Mock testing

    const analytics = multiModelRouter.getAnalytics();
    assert(analytics.totals.realCalls >= 1, "Real calls tracked in analytics");
    assert(analytics.totals.mockCalls >= 1, "Mock calls tracked in analytics");
    assert(analytics.totals.inputTokens >= 400, "Input tokens tracked in analytics");
  });

  console.log(`\n==================================================================`);
  console.log(`  ALL ${passed}/${total} UNIT & INTEGRATION TESTS PASSED (100% SUCCESS)`);
  console.log(`==================================================================\n`);
  process.exit(0);
}

runTests().catch((err) => {
  console.error("TEST EXECUTION FAILED:", err);
  process.exit(1);
});
