// Task Execution Engine for OpenCrewBot 2.0
// Manages task DAG dependencies, parallel and sequential execution, retries, timeouts, and failure recovery.

import { randomUUID } from "node:crypto";
import type { Task, TaskPlan, TaskPriority, TaskStatus, Bot } from "@/lib/shared/types";
import * as store from "../db";
import { publish } from "../bus";
import { runTurn } from "../runtime";
import { logAudit } from "../db";

// In-memory active plan runners to manage cancellation and timeouts
interface RunningPlanContext {
  planId: string;
  cancelled: boolean;
  abortController: AbortController;
  activeTaskPromises: Map<string, Promise<void>>;
}

const activePlans = new Map<string, RunningPlanContext>();

export class TaskExecutionEngine {
  /**
   * Creates a new Task Plan with a set of tasks and saves it.
   */
  async createPlan(goal: string, conversationId?: string, taskInputs?: Array<Omit<Task, "id" | "planId" | "createdAt" | "status">>): Promise<TaskPlan> {
    const planId = randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const rawTasks = taskInputs ?? [];
    const tasks: Task[] = rawTasks.map((t, idx) => {
      const taskId = `task-${planId}-${idx + 1}`;
      const mappedDeps = t.dependencies.map((dep) => {
        const match = dep.match(/dep-index-(\d+)/);
        if (match) {
          const depIdx = parseInt(match[1], 10);
          return `task-${planId}-${depIdx + 1}`;
        }
        return dep;
      });

      return {
        ...t,
        id: taskId,
        planId,
        dependencies: mappedDeps,
        status: "pending" as TaskStatus,
        createdAt: now,
        retryCount: 0,
        maxRetries: t.maxRetries ?? 2,
        timeoutMs: t.timeoutMs ?? 120_000,
      };
    });

    const plan: TaskPlan = {
      id: planId,
      goal,
      conversationId,
      status: "planning",
      tasks,
      createdAt: now,
      updatedAt: now,
    };

    await store.saveTaskPlan(plan);
    for (const task of tasks) {
      await store.saveTask(task);
    }

    publish({ type: "plan-updated", plan });
    publish({ type: "tasks-changed" });
    return plan;
  }

  /**
   * Execute a Task Plan adhering to the DAG dependencies.
   * Runs independent tasks in parallel and dependent tasks sequentially.
   */
  async executePlan(planId: string): Promise<TaskPlan> {
    const plan = await store.getTaskPlan(planId);
    if (!plan) throw new Error(`Task plan ${planId} not found`);

    const ctx: RunningPlanContext = {
      planId,
      cancelled: false,
      abortController: new AbortController(),
      activeTaskPromises: new Map(),
    };
    activePlans.set(planId, ctx);

    plan.status = "executing";
    plan.updatedAt = new Date().toISOString();
    await store.saveTaskPlan(plan);
    publish({ type: "plan-updated", plan });

    const tasks = await store.listTasksByPlan(planId);
    const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]));
    const completedTaskIds = new Set<string>(tasks.filter((t) => t.status === "completed").map((t) => t.id));
    const runningTaskIds = new Set<string>();

    const checkAndDispatch = async () => {
      if (ctx.cancelled) return;

      const runnableTasks = Array.from(taskMap.values()).filter((task) => {
        if (task.status !== "pending" && task.status !== "scheduled") return false;
        // Check if all dependencies are completed
        const depsSatisfied = task.dependencies.every((depId) => completedTaskIds.has(depId));
        return depsSatisfied && !runningTaskIds.has(task.id);
      });

      for (const task of runnableTasks) {
        runningTaskIds.add(task.id);
        const promise = this.executeTask(task, ctx, taskMap)
          .then(async (updatedTask) => {
            taskMap.set(updatedTask.id, updatedTask);
            runningTaskIds.delete(updatedTask.id);
            ctx.activeTaskPromises.delete(updatedTask.id);

            if (updatedTask.status === "completed") {
              completedTaskIds.add(updatedTask.id);
              await checkAndDispatch();
            }
          })
          .catch(async (err) => {
            runningTaskIds.delete(task.id);
            ctx.activeTaskPromises.delete(task.id);
            task.status = "failed";
            task.error = err instanceof Error ? err.message : String(err);
            task.completedAt = new Date().toISOString();
            taskMap.set(task.id, task);
            await store.saveTask(task);
            publish({ type: "tasks-changed" });
          });

        ctx.activeTaskPromises.set(task.id, promise);
      }
    };

    // Initial dispatch
    await checkAndDispatch();

    // Wait until all dispatched tasks finish
    while (ctx.activeTaskPromises.size > 0 && !ctx.cancelled) {
      await Promise.race(Array.from(ctx.activeTaskPromises.values()));
    }

    activePlans.delete(planId);

    // Refresh final tasks
    const finalTasks = await store.listTasksByPlan(planId);
    const hasFailures = finalTasks.some((t) => t.status === "failed");
    const allDone = finalTasks.every((t) => t.status === "completed");

    plan.tasks = finalTasks;
    plan.status = ctx.cancelled ? "interrupted" : hasFailures ? "failed" : allDone ? "completed" : "executing";
    plan.updatedAt = new Date().toISOString();
    await store.saveTaskPlan(plan);
    publish({ type: "plan-updated", plan });

    return plan;
  }

  /**
   * Executes an individual task with retries, timeout handling, and approval verification.
   */
  private async executeTask(task: Task, ctx: RunningPlanContext, allTasks: Map<string, Task>): Promise<Task> {
    if (ctx.cancelled) {
      task.status = "cancelled";
      await store.saveTask(task);
      return task;
    }

    // Check if task requires human approval first
    if (task.requiresApproval && task.approvalStatus !== "approved") {
      task.status = "awaiting-approval";
      await store.saveTask(task);
      publish({ type: "tasks-changed" });
      return task;
    }

    task.status = "running";
    task.startedAt = new Date().toISOString();
    await store.saveTask(task);
    publish({ type: "tasks-changed" });

    const bot = await store.getBot(task.assignedAgentId);
    if (!bot) {
      task.status = "failed";
      task.error = `Assigned agent ${task.assignedAgentId} not found`;
      task.completedAt = new Date().toISOString();
      await store.saveTask(task);
      return task;
    }

    // Prepare context from dependencies
    const depOutputs = task.dependencies
      .map((dId) => allTasks.get(dId))
      .filter((d): d is Task => Boolean(d && d.output))
      .map((d) => `### Input from ${d.title}:\n${d.output}`)
      .join("\n\n");

    const promptText = [
      `[Task: ${task.title}]`,
      `Description: ${task.description}`,
      typeof task.input === "string" ? `Input:\n${task.input}` : `Input:\n${JSON.stringify(task.input, null, 2)}`,
      depOutputs ? `Dependencies & Prior Results:\n${depOutputs}` : "",
      "Execute this task thoroughly. Provide clear, evidence-based, actionable outputs.",
    ]
      .filter(Boolean)
      .join("\n\n");

    let attempt = 0;
    const maxRetries = task.maxRetries ?? 2;

    while (attempt <= maxRetries && !ctx.cancelled) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Task timed out after ${task.timeoutMs}ms`)), task.timeoutMs || 120_000),
        );

        const executionPromise = (async () => {
          const conversationId = `dm:${bot.id}`;
          const reply = await runTurn({
            bot,
            conversationId,
            content: promptText,
          });

          if (!reply) throw new Error("Agent returned no response");
          if (reply.status === "error") throw new Error(reply.error || "Agent execution failed");

          const textParts = reply.parts
            .filter((p) => p.kind === "text")
            .map((p) => (p as { text: string }).text)
            .join("\n");

          return textParts || "Task completed successfully.";
        })();

        const result = await Promise.race([executionPromise, timeoutPromise]);

        task.status = "completed";
        task.output = result;
        task.completedAt = new Date().toISOString();
        task.error = undefined;
        await store.saveTask(task);
        publish({ type: "tasks-changed" });

        await logAudit({
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          actor: bot.id,
          action: "task_executed",
          resource: task.id,
          details: `Executed task: ${task.title}`,
          permissionLevel: bot.approval,
          approved: true,
        });

        return task;
      } catch (err) {
        attempt++;
        task.retryCount = attempt;
        if (attempt > maxRetries) {
          task.status = "failed";
          task.error = err instanceof Error ? err.message : String(err);
          task.completedAt = new Date().toISOString();
          await store.saveTask(task);
          publish({ type: "tasks-changed" });

          await logAudit({
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            actor: bot.id,
            action: "task_failed",
            resource: task.id,
            details: `Task failed: ${task.title}. Error: ${task.error}`,
            permissionLevel: bot.approval,
            approved: false,
            reason: task.error,
          });

          return task;
        }
        // Exponential backoff before retry
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }

    return task;
  }

  /**
   * Approve a task waiting for approval, resuming execution.
   */
  async approveTask(taskId: string, approved: boolean, reason?: string): Promise<Task> {
    const task = await store.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    task.approvalStatus = approved ? "approved" : "rejected";
    if (!approved) {
      task.status = "failed";
      task.error = `Action rejected by human operator${reason ? `: ${reason}` : ""}`;
      task.completedAt = new Date().toISOString();
    } else {
      task.status = "pending";
    }

    await store.saveTask(task);
    publish({ type: "tasks-changed" });

    await logAudit({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      actor: "user",
      action: approved ? "task_approved" : "task_rejected",
      resource: taskId,
      details: `Human approval for ${task.title}: ${approved ? "ALLOWED" : "REJECTED"}`,
      permissionLevel: "ask",
      approved,
      reason,
    });

    if (approved && task.planId) {
      // Re-trigger plan execution to process the newly approved task
      void this.executePlan(task.planId).catch(() => {});
    }

    return task;
  }

  /**
   * Cancel an in-flight task plan.
   */
  async cancelPlan(planId: string): Promise<void> {
    const ctx = activePlans.get(planId);
    if (ctx) {
      ctx.cancelled = true;
      ctx.abortController.abort();
      activePlans.delete(planId);
    }

    const plan = await store.getTaskPlan(planId);
    if (plan) {
      plan.status = "interrupted";
      plan.updatedAt = new Date().toISOString();
      await store.saveTaskPlan(plan);
      publish({ type: "plan-updated", plan });
    }

    const tasks = await store.listTasksByPlan(planId);
    for (const task of tasks) {
      if (task.status === "running" || task.status === "pending" || task.status === "scheduled") {
        task.status = "cancelled";
        await store.saveTask(task);
      }
    }
    publish({ type: "tasks-changed" });
  }
}

export const taskEngine = new TaskExecutionEngine();
