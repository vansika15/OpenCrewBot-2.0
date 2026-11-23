// Multi-Tier Persistent Memory Engine for OpenCrewBot 2.0
// Supports:
// 1. Individual Agent Memory (data/workspaces/<botId>/MEMORY.md)
// 2. Shared Room Memory (data/rooms/<roomId>/ROOM_MEMORY.md)
// 3. Global Project Memory (data/project/PROJECT_MEMORY.md)
// 4. Memory Provenance Tracking (what, when, why, where)
// Persists directly in human-editable Markdown across application restarts.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, WORKSPACES_DIR } from "../config";
import type { MemoryProvenance } from "@/lib/shared/types";
import { publish } from "../bus";
import { redactSecrets } from "../memory-files";

export const PROJECT_DIR = join(DATA_DIR, "project");
export const ROOMS_DIR = join(DATA_DIR, "rooms");

mkdirSync(PROJECT_DIR, { recursive: true });
mkdirSync(ROOMS_DIR, { recursive: true });

export const PROJECT_MEMORY_PATH = join(PROJECT_DIR, "PROJECT_MEMORY.md");

export function roomMemoryPath(roomId: string): string {
  const dir = join(ROOMS_DIR, roomId.replace(/[^a-zA-Z0-9_-]/g, ""));
  mkdirSync(dir, { recursive: true });
  return join(dir, "ROOM_MEMORY.md");
}

export function agentMemoryPath(botId: string): string {
  const dir = join(WORKSPACES_DIR, botId.replace(/[^a-zA-Z0-9_-]/g, ""));
  mkdirSync(dir, { recursive: true });
  return join(dir, "MEMORY.md");
}

function safeRead(path: string, fallbackDefault: string): string {
  if (!existsSync(path)) {
    safeWrite(path, fallbackDefault);
    return fallbackDefault;
  }
  return readFileSync(path, "utf8");
}

function safeWrite(path: string, content: string): string {
  const clean = redactSecrets(content);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, clean, { mode: 0o600 });
  renameSync(tmp, path);
  return clean;
}

export class MemoryManager {
  // ── Global Project Memory ─────────────────────────────────────────────

  getProjectMemory(): string {
    const defaultContent =
      "# Enterprise Project Memory\n\n" +
      "## Company Context: MeetUniversity\n" +
      "- Product Line 1: Aspirations — Career discovery and navigation for Class 11-12 students.\n" +
      "- Product Line 2: Study Abroad & University Applications — Comprehensive guidance for international admissions.\n" +
      "- Product Line 3: School Partnerships — Enterprise tie-ups with K-12 schools for career curriculum.\n\n" +
      "## Global Operating Guidelines\n" +
      "- Maintain high analytical rigor in all calculations.\n" +
      "- Always require human confirmation before external write/dispatch operations.\n\n" +
      "## Historical Decisions & Log\n";

    return safeRead(PROJECT_MEMORY_PATH, defaultContent);
  }

  saveProjectMemory(content: string): string {
    const res = safeWrite(PROJECT_MEMORY_PATH, content);
    publish({ type: "project-memory-changed" });
    return res;
  }

  appendProjectMemory(provenance: MemoryProvenance): void {
    let current = this.getProjectMemory().trimEnd();
    const entry =
      `\n- **[${provenance.category || "Finding"}]**: ${provenance.what.trim().replace(/\n+/g, " ")}\n` +
      `  - *When*: ${provenance.when || new Date().toISOString()}\n` +
      `  - *Why*: ${provenance.why || "Global project knowledge update"}\n` +
      `  - *Source*: ${provenance.where || "Chief of Staff"}`;

    this.saveProjectMemory(`${current}\n${entry}\n`);
  }

  // ── Shared Room Memory ────────────────────────────────────────────────

  getRoomMemory(roomId: string, roomName = "Collaboration Room"): string {
    const path = roomMemoryPath(roomId);
    const defaultContent = `# ${roomName} — Shared Room Memory\n\n## Collaborative Context & Active Objectives\n\n## Shared Research & Key Decisions\n`;
    return safeRead(path, defaultContent);
  }

  saveRoomMemory(roomId: string, content: string): string {
    const path = roomMemoryPath(roomId);
    const res = safeWrite(path, content);
    publish({ type: "rooms-changed" });
    return res;
  }

  appendRoomMemory(roomId: string, provenance: MemoryProvenance): void {
    let current = this.getRoomMemory(roomId).trimEnd();
    const entry =
      `\n- **[${provenance.category || "Room Decision"}]**: ${provenance.what.trim().replace(/\n+/g, " ")}\n` +
      `  - *When*: ${provenance.when || new Date().toISOString()}\n` +
      `  - *Why*: ${provenance.why || "Room team consensus"}\n` +
      `  - *Source*: ${provenance.where || "Teammate contribution"}`;

    this.saveRoomMemory(roomId, `${current}\n${entry}\n`);
  }

  // ── Individual Agent Memory ───────────────────────────────────────────

  getAgentMemory(botId: string, botName = "Agent"): string {
    const path = agentMemoryPath(botId);
    const defaultContent = `# ${botName}'s Memory\n\n## Preferences & Instructions\n\n## Durable Facts\n`;
    return safeRead(path, defaultContent);
  }

  saveAgentMemory(botId: string, content: string): string {
    const path = agentMemoryPath(botId);
    const res = safeWrite(path, content);
    publish({ type: "memory-changed", botId });
    return res;
  }

  appendAgentMemory(botId: string, provenance: MemoryProvenance): void {
    let current = this.getAgentMemory(botId).trimEnd();
    const entry =
      `\n- **[${provenance.category || "Fact"}]**: ${provenance.what.trim().replace(/\n+/g, " ")}\n` +
      `  - *When*: ${provenance.when || new Date().toISOString()}\n` +
      `  - *Why*: ${provenance.why || "User preference or task context"}\n` +
      `  - *Source*: ${provenance.where || "User Interaction"}`;

    this.saveAgentMemory(botId, `${current}\n${entry}\n`);
  }

  // ── Exact Editing & Corrections (Scenario 6) ──────────────────────────

  editMemoryExact(filePath: string, find: string, replace: string): { ok: boolean; reason?: string } {
    if (!existsSync(filePath)) {
      return { ok: false, reason: "Memory file does not exist." };
    }
    const content = readFileSync(filePath, "utf8");
    const count = content.split(find).length - 1;
    if (!find || count === 0) {
      return { ok: false, reason: `Exact text '${find}' not found in file. Copy text exactly.` };
    }
    if (count > 1) {
      return { ok: false, reason: `Found ${count} occurrences. Please specify more surrounding context.` };
    }

    const updated = content.replace(find, replace);
    safeWrite(filePath, updated);
    return { ok: true };
  }

  // ── Combined Context for System Prompt ────────────────────────────────

  loadFullMemoryContext(botId: string, roomId?: string): string {
    const sections: string[] = [];

    // 1. Global Project Memory
    const projectMem = this.getProjectMemory().trim();
    if (projectMem) {
      sections.push(`[GLOBAL ENTERPRISE MEMORY]\n${projectMem.slice(0, 4000)}`);
    }

    // 2. Room Memory (if within a room)
    if (roomId) {
      const roomMem = this.getRoomMemory(roomId).trim();
      if (roomMem) {
        sections.push(`[SHARED ROOM MEMORY]\n${roomMem.slice(0, 4000)}`);
      }
    }

    // 3. Agent Personal Memory
    const agentMem = this.getAgentMemory(botId).trim();
    if (agentMem) {
      sections.push(`[AGENT PERSONAL MEMORY]\n${agentMem.slice(0, 4000)}`);
    }

    return sections.join("\n\n---\n\n");
  }
}

export const memoryManager = new MemoryManager();
