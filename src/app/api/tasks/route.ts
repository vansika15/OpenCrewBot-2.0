import { body, handle } from "@/lib/server/http";
import * as store from "@/lib/server/db";
import { taskEngine } from "@/lib/server/tasks/engine";
import { InputError } from "@/lib/server/errors";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  return handle(async () => {
    const url = new URL(request.url);
    const planId = url.searchParams.get("planId");
    if (planId) {
      const tasks = await store.listTasksByPlan(planId);
      const plan = await store.getTaskPlan(planId);
      return { tasks, plan };
    }
    const tasks = await store.listTasks(100);
    const plans = await store.listTaskPlans();
    return { tasks, plans };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { goal, conversationId, tasks } = await body<{
      goal: string;
      conversationId?: string;
      tasks?: Array<{
        title: string;
        description: string;
        assignedAgentId: string;
        dependencies: string[];
        priority: "low" | "medium" | "high" | "critical";
        input: Record<string, unknown> | string;
        requiresApproval: boolean;
      }>;
    }>(request);

    if (!goal || !goal.trim()) {
      throw new InputError("Goal is required to create a task plan.");
    }

    const plan = await taskEngine.createPlan(goal.trim(), conversationId, tasks);
    void taskEngine.executePlan(plan.id).catch(() => {});
    return { plan };
  });
}
