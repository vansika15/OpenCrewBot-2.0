import { body, handle } from "@/lib/server/http";
import { memoryManager, PROJECT_MEMORY_PATH, roomMemoryPath, agentMemoryPath } from "@/lib/server/memory/memory-manager";
import { InputError } from "@/lib/server/errors";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  return handle(async () => {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") || "project";
    const id = url.searchParams.get("id");

    if (scope === "project") {
      return {
        scope: "project",
        path: PROJECT_MEMORY_PATH,
        content: memoryManager.getProjectMemory(),
      };
    }

    if (scope === "room") {
      if (!id) throw new InputError("Room id is required for room memory.");
      return {
        scope: "room",
        id,
        path: roomMemoryPath(id),
        content: memoryManager.getRoomMemory(id),
      };
    }

    if (scope === "bot" || scope === "agent") {
      if (!id) throw new InputError("Bot id is required for agent memory.");
      return {
        scope: "bot",
        id,
        path: agentMemoryPath(id),
        content: memoryManager.getAgentMemory(id),
      };
    }

    throw new InputError(`Unknown memory scope: ${scope}`);
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const { scope, id, content } = await body<{ scope?: string; id?: string; content: string }>(request);
    if (content === undefined) throw new InputError("Content is required.");

    if (!scope || scope === "project") {
      const saved = memoryManager.saveProjectMemory(content);
      return { scope: "project", content: saved };
    }

    if (scope === "room") {
      if (!id) throw new InputError("Room id is required.");
      const saved = memoryManager.saveRoomMemory(id, content);
      return { scope: "room", id, content: saved };
    }

    if (scope === "bot" || scope === "agent") {
      if (!id) throw new InputError("Bot id is required.");
      const saved = memoryManager.saveAgentMemory(id, content);
      return { scope: "bot", id, content: saved };
    }

    throw new InputError(`Unknown memory scope: ${scope}`);
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const { scope, id, find, replace } = await body<{ scope?: string; id?: string; find: string; replace: string }>(request);
    if (!find) throw new InputError("The 'find' parameter is required for exact memory editing.");

    let targetPath = PROJECT_MEMORY_PATH;
    if (scope === "room") {
      if (!id) throw new InputError("Room id is required.");
      targetPath = roomMemoryPath(id);
    } else if (scope === "bot" || scope === "agent") {
      if (!id) throw new InputError("Bot id is required.");
      targetPath = agentMemoryPath(id);
    }

    const result = memoryManager.editMemoryExact(targetPath, find, replace ?? "");
    if (!result.ok) {
      throw new InputError(result.reason || "Failed to edit memory.");
    }

    return { ok: true, scope: scope || "project", id, replaced: true };
  });
}
