import { body, handle } from "@/lib/server/http";
import { approvalCenter } from "@/lib/server/security/approval-center";
import { InputError } from "@/lib/server/errors";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  return handle(async () => {
    const url = new URL(request.url);
    const all = url.searchParams.get("all") === "true";
    const requests = all ? approvalCenter.listAll() : approvalCenter.listPending();
    return { requests };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { id, approve, reason, actor } = await body<{
      id: string;
      approve: boolean;
      reason?: string;
      actor?: string;
    }>(request);

    if (!id) throw new InputError("Approval request id is required.");
    if (approve === undefined) throw new InputError("Decision (approve: boolean) is required.");

    const result = await approvalCenter.resolveApproval(id, approve, actor || "human_supervisor", reason);
    return { result };
  });
}
