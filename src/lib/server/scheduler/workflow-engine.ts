// Scheduled Automation & Workflow Engine for OpenCrewBot 2.0
// Manages recurring AI workflows (cron / interval), execution history, pause/resume, and manual triggers.

import { randomUUID } from "node:crypto";
import type { Workflow, WorkflowRun } from "@/lib/shared/types";
import * as store from "../db";
import { publish } from "../bus";
import { runTurn } from "../runtime";
import { logAudit } from "../db";

class WorkflowEngine {
  private timer: NodeJS.Timeout | null = null;
  private isChecking = false;

  constructor() {
    this.startScheduler();
  }

  private startScheduler() {
    if (this.timer) return;
    // Check every 30 seconds for scheduled workflows
    this.timer = setInterval(() => {
      void this.checkAndRunDueWorkflows();
    }, 30_000);
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Evaluates all enabled workflows and triggers any that are due.
   */
  async checkAndRunDueWorkflows() {
    if (this.isChecking) return;
    this.isChecking = true;
    try {
      const workflows = await store.listWorkflows();
      const now = Date.now();

      for (const wf of workflows) {
        if (!wf.enabled) continue;

        let isDue = false;
        if (wf.nextRunAt) {
          isDue = new Date(wf.nextRunAt).getTime() <= now;
        } else if (wf.intervalMinutes) {
          const lastRun = wf.lastRunAt ? new Date(wf.lastRunAt).getTime() : 0;
          isDue = now - lastRun >= wf.intervalMinutes * 60 * 1000;
        }

        if (isDue) {
          await this.executeWorkflow(wf.id);
        }
      }
    } catch {
      // Ignore background ticker errors
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Creates a new scheduled workflow.
   */
  async createWorkflow(input: Omit<Workflow, "id" | "createdAt">): Promise<Workflow> {
    const id = `wf-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const nextRun = input.intervalMinutes
      ? new Date(Date.now() + input.intervalMinutes * 60 * 1000).toISOString()
      : undefined;

    const wf: Workflow = {
      ...input,
      id,
      createdAt: now,
      nextRunAt: nextRun,
    };

    await store.saveWorkflow(wf);
    publish({ type: "workflow-updated", workflowId: id });
    return wf;
  }

  /**
   * Pause or resume a workflow.
   */
  async toggleWorkflow(id: string, enabled: boolean): Promise<Workflow> {
    const wf = await store.getWorkflow(id);
    if (!wf) throw new Error(`Workflow ${id} not found`);

    wf.enabled = enabled;
    if (enabled && wf.intervalMinutes) {
      wf.nextRunAt = new Date(Date.now() + wf.intervalMinutes * 60 * 1000).toISOString();
    }

    await store.saveWorkflow(wf);
    publish({ type: "workflow-updated", workflowId: id });

    await logAudit({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      actor: "user",
      action: enabled ? "workflow_resumed" : "workflow_paused",
      resource: id,
      details: `${enabled ? "Resumed" : "Paused"} workflow: ${wf.name}`,
      permissionLevel: "full",
      approved: true,
    });

    return wf;
  }

  /**
   * Manually triggers or runs a due workflow.
   */
  async executeWorkflow(id: string): Promise<WorkflowRun> {
    const wf = await store.getWorkflow(id);
    if (!wf) throw new Error(`Workflow ${id} not found`);

    const runId = `run-${randomUUID().slice(0, 8)}`;
    const startTime = new Date().toISOString();

    const run: WorkflowRun = {
      id: runId,
      workflowId: id,
      status: "running",
      startedAt: startTime,
    };
    await store.saveWorkflowRun(run);

    try {
      // Determine target bot
      const allBots = await store.listBots();
      const bot = (wf.agentId && allBots.find((b) => b.id === wf.agentId)) || allBots[0];
      if (!bot) throw new Error("No agent available to run this workflow.");

      const conversationId = wf.roomId ? `room:${wf.roomId}` : `dm:${bot.id}`;
      const reply = await runTurn({
        bot,
        conversationId,
        content: `[Scheduled Autonomous Routine: "${wf.name}"]\n\n${wf.prompt}`,
      });

      const outputText = reply?.parts
        .filter((p) => p.kind === "text")
        .map((p) => (p as { text: string }).text)
        .join("\n");

      run.status = "completed";
      run.output = outputText || "Autonomous routine completed successfully with no textual output.";
      run.completedAt = new Date().toISOString();
      await store.saveWorkflowRun(run);

      // Update workflow last/next run timestamps
      wf.lastRunAt = run.completedAt;
      if (wf.intervalMinutes) {
        wf.nextRunAt = new Date(Date.now() + wf.intervalMinutes * 60 * 1000).toISOString();
      }
      await store.saveWorkflow(wf);

      await logAudit({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        actor: bot.id,
        action: "workflow_executed",
        resource: id,
        details: `Autonomous routine executed: ${wf.name}`,
        permissionLevel: bot.approval,
        approved: true,
      });

      publish({ type: "workflow-updated", workflowId: id });
      return run;
    } catch (err) {
      run.status = "failed";
      run.error = err instanceof Error ? err.message : String(err);
      run.completedAt = new Date().toISOString();
      await store.saveWorkflowRun(run);

      await logAudit({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        actor: wf.agentId || "system",
        action: "workflow_failed",
        resource: id,
        details: `Routine failed: ${wf.name}. Error: ${run.error}`,
        permissionLevel: "full",
        approved: false,
        reason: run.error,
      });

      publish({ type: "workflow-updated", workflowId: id });
      return run;
    }
  }

  /**
   * Seeds default business workflows for demonstration if none exist.
   */
  async seedDefaultWorkflows() {
    const existing = await store.listWorkflows();
    if (existing.length > 0) return;

    const allBots = await store.listBots();
    const radar = allBots.find((b) => b.name === "Radar") || allBots[0];
    const metric = allBots.find((b) => b.name === "Metric") || allBots[0];
    const forge = allBots.find((b) => b.name === "Forge") || allBots[0];

    if (!radar) return;

    // Demonstration 5 Routine: Recurring Competitor Monitoring
    await this.createWorkflow({
      name: "Competitor Intelligence Sentinel",
      description: "Monitors EdTech competitor pricing changes, feature announcements, and positioning shifts every 60 minutes.",
      intervalMinutes: 60,
      agentId: radar.id,
      prompt: "Execute routine competitor monitoring for MeetUniversity. Review changes in competitor offerings (LeverageEdu, IDP, Mindler, Leap Scholar). Report newly identified opportunities or pricing adjustments.",
      enabled: true,
    });

    // Weekly Business Sales Funnel Audit
    await this.createWorkflow({
      name: "Weekly Sales Funnel Performance Audit",
      description: "Audits lead conversion drop-offs, Aspirations assessment completion rates, and sales pipeline bottlenecks.",
      intervalMinutes: 1440, // 24 hours
      agentId: metric.id,
      prompt: "Analyze the current sales pipeline conversion funnel. Identify drop-offs between Lead -> Counselor -> Diagnostic -> Enrolled. Calculate estimated revenue upside from addressing the primary bottleneck.",
      enabled: true,
    });

    // Repository Security & Vulnerability Scan
    await this.createWorkflow({
      name: "Repository Architecture & Security Sentinel",
      description: "Periodically audits repository dependencies and code changes for security advisories.",
      intervalMinutes: 720, // 12 hours
      agentId: forge.id,
      prompt: "Perform automated codebase health check. Inspect recent commits and verify security boundaries. Formulate prioritized action items for pending advisories.",
      enabled: false, // Initially paused for demonstration of pause/resume
    });
  }
}

export const workflowEngine = new WorkflowEngine();
