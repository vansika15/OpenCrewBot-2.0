import { body, handle } from "@/lib/server/http";
import * as store from "@/lib/server/db";
import { workflowEngine } from "@/lib/server/scheduler/workflow-engine";
import { InputError } from "@/lib/server/errors";

export async function GET() {
  return handle(async () => {
    await workflowEngine.seedDefaultWorkflows();
    const workflows = await store.listWorkflows();
    const runs = await store.listWorkflowRuns(undefined, 20);
    return { workflows, recentRuns: runs };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { action, workflowId, name, description, intervalMinutes, agentId, roomId, prompt, enabled } = await body<{
      action?: string;
      workflowId?: string;
      name?: string;
      description?: string;
      intervalMinutes?: number;
      agentId?: string;
      roomId?: string;
      prompt?: string;
      enabled?: boolean;
    }>(request);

    if (action === "trigger" && workflowId) {
      const run = await workflowEngine.executeWorkflow(workflowId);
      return { run };
    }

    if (!name || !prompt) {
      throw new InputError("Workflow name and prompt are required.");
    }

    const workflow = await workflowEngine.createWorkflow({
      name,
      description: description || "",
      intervalMinutes: intervalMinutes || 60,
      agentId,
      roomId,
      prompt,
      enabled: enabled ?? true,
    });

    return { workflow };
  });
}
