import { body, handle } from "@/lib/server/http";
import { chiefOfStaff } from "@/lib/server/orchestration/chief-of-staff";
import { InputError } from "@/lib/server/errors";

export async function POST(request: Request) {
  return handle(async () => {
    const { goal, conversationId } = await body<{ goal: string; conversationId?: string }>(request);
    if (!goal || !goal.trim()) {
      throw new InputError("Goal directive is required for Chief of Staff orchestration.");
    }
    const plan = await chiefOfStaff.orchestrate(goal.trim(), conversationId);
    return { plan };
  });
}
