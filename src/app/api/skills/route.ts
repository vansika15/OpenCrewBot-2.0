import { body, handle } from "@/lib/server/http";
import { skillsRegistry } from "@/lib/server/skills/registry";
import { InputError } from "@/lib/server/errors";

export async function GET() {
  return handle(async () => {
    const skills = skillsRegistry.list().map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      instructions: s.instructions,
      enabled: s.enabled,
      createdAt: s.createdAt,
    }));
    return { skills };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { skillId, input, agentId } = await body<{
      skillId: string;
      input: Record<string, unknown> | string;
      agentId?: string;
    }>(request);

    if (!skillId) {
      throw new InputError("skillId is required to execute a skill.");
    }

    const result = await skillsRegistry.execute(skillId, { input: input || {}, agentId });
    return { result };
  });
}
