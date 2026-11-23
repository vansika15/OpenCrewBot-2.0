import { body, handle } from "@/lib/server/http";
import * as store from "@/lib/server/db";
import { taskEngine } from "@/lib/server/tasks/engine";
import { InputError } from "@/lib/server/errors";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const task = await store.getTask(id);
    if (!task) throw new InputError(`Task ${id} not found`);
    return { task };
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const { action, approved, reason } = await body<{ action?: string; approved?: boolean; reason?: string }>(request);

    if (action === "approve" || approved !== undefined) {
      const isApproved = approved ?? action === "approve";
      const updated = await taskEngine.approveTask(id, isApproved, reason);
      return { task: updated };
    }

    const task = await store.getTask(id);
    if (!task) throw new InputError(`Task ${id} not found`);
    return { task };
  });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    await store.deleteTask(id);
    return { ok: true };
  });
}
