import { body, handle } from "@/lib/server/http";
import * as store from "@/lib/server/db";
import { workflowEngine } from "@/lib/server/scheduler/workflow-engine";
import { InputError } from "@/lib/server/errors";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const workflow = await store.getWorkflow(id);
    if (!workflow) throw new InputError(`Workflow ${id} not found`);
    const runs = await store.listWorkflowRuns(id, 50);
    return { workflow, runs };
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const { action, enabled } = await body<{ action?: string; enabled?: boolean }>(request);

    if (action === "trigger") {
      const run = await workflowEngine.executeWorkflow(id);
      return { run };
    }

    if (enabled !== undefined) {
      const updated = await workflowEngine.toggleWorkflow(id, enabled);
      return { workflow: updated };
    }

    const workflow = await store.getWorkflow(id);
    return { workflow };
  });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    await store.deleteWorkflow(id);
    return { ok: true };
  });
}
