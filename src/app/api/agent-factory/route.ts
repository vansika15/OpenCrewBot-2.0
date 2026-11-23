import { body, handle } from "@/lib/server/http";
import { agentFactory } from "@/lib/server/agent-factory/factory";
import { InputError } from "@/lib/server/errors";
import type { ApprovalMode } from "@/lib/shared/types";

export async function POST(request: Request) {
  return handle(async () => {
    const { prompt, preferredModel, permissionLevel } = await body<{
      prompt: string;
      preferredModel?: string;
      permissionLevel?: ApprovalMode;
    }>(request);

    if (!prompt || !prompt.trim()) {
      throw new InputError("Agent prompt description is required.");
    }

    const result = await agentFactory.createAgentFromPrompt({
      prompt: prompt.trim(),
      preferredModel,
      permissionLevel,
    });

    return result;
  });
}
