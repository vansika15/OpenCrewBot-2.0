// Multi-Agent Collaboration Engine for OpenCrewBot 2.0
// Enables structured inter-agent collaboration: delegation, peer critique/verification,
// artifact sharing, and loop prevention with depth and cycle budgets.

import { randomUUID } from "node:crypto";
import type { Bot, ChatMessage, Room } from "@/lib/shared/types";
import * as store from "../db";
import { memoryManager } from "../memory/memory-manager";
import { runTurn, stopEpochOf } from "../runtime";
import { roomConversationId } from "../rooms";
import { publish } from "../bus";

export interface CollaborationArtifact {
  id: string;
  name: string;
  authorBotId: string;
  content: string;
  timestamp: string;
}

export interface CollaborationSession {
  sessionId: string;
  roomId: string;
  objective: string;
  artifacts: CollaborationArtifact[];
  turnCount: number;
  maxTurns: number;
  status: "active" | "completed" | "interrupted";
}

const activeSessions = new Map<string, CollaborationSession>();

export class CollaborationRoomEngine {
  private readonly MAX_ROOM_TURNS = 6; // Strict boundary to prevent runaway conversations

  /**
   * Starts or retrieves an active collaboration session in a room.
   */
  getOrCreateSession(roomId: string, objective: string): CollaborationSession {
    let session = activeSessions.get(roomId);
    if (!session || session.status !== "active") {
      session = {
        sessionId: randomUUID().slice(0, 8),
        roomId,
        objective,
        artifacts: [],
        turnCount: 0,
        maxTurns: this.MAX_ROOM_TURNS,
        status: "active",
      };
      activeSessions.set(roomId, session);
    }
    return session;
  }

  /**
   * Executes a structured multi-agent collaboration workflow:
   * 1. Room Lead introduces the goal and delegates sub-tasks
   * 2. Specialists execute independent research and contribute artifacts
   * 3. Critic/Verifier reviews and challenges conclusions
   * 4. Synthesizer records final room consensus in ROOM_MEMORY.md
   */
  async runCollaborativeSession(roomId: string, directive: string): Promise<CollaborationSession> {
    const room = await store.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const allBots = await store.listBots();
    const botMap = new Map(allBots.map((b) => [b.id, b]));
    const members = room.memberIds.map((id) => botMap.get(id)).filter((b): b is Bot => Boolean(b));

    if (members.length === 0) {
      throw new Error(`Room ${room.name} has no assigned member bots.`);
    }

    const session = this.getOrCreateSession(roomId, directive);
    const conversationId = roomConversationId(roomId);
    const epoch = stopEpochOf(conversationId);

    // Identify roles: Lead, Specialist, Critic
    const lead = members.find((m) => m.id === room.leadId) || members[0];
    const specialists = members.filter((m) => m.id !== lead.id);
    const critic = specialists.length > 1 ? specialists[specialists.length - 1] : lead;

    // Step 1: Lead establishes room directive & records in Room Memory
    memoryManager.appendRoomMemory(roomId, {
      what: `Collaboration initiated for directive: "${directive}"`,
      when: new Date().toISOString(),
      why: "Lead establishing active room objective",
      where: `Lead ${lead.name}`,
      category: "Objective",
    });

    // Step 2: Specialists contribute research and analysis
    for (const specialist of specialists) {
      if (session.turnCount >= session.maxTurns || stopEpochOf(conversationId) !== epoch) break;

      const sharedMemory = memoryManager.getRoomMemory(roomId);
      const specialistPrompt = [
        `[Multi-Agent Collaboration Room: "${room.name}"]`,
        `Overall Objective: ${directive}`,
        `Current Shared Room Context:\n${sharedMemory}`,
        `Your Role: ${specialist.name} (${specialist.title}).`,
        "Provide your specialised perspective, data points, and recommendations. To share an artifact, format it clearly. (Keep response concise, max 100 words).",
      ].join("\n\n");

      const reply = await runTurn({
        bot: specialist,
        conversationId,
        content: specialistPrompt,
        route: { by: "lead" },
      });

      session.turnCount++;

      if (reply && reply.status === "done") {
        const text = reply.parts
          .filter((p) => p.kind === "text")
          .map((p) => (p as { text: string }).text)
          .join("\n");

        if (text) {
          session.artifacts.push({
            id: randomUUID().slice(0, 6),
            name: `${specialist.name}'s Contribution`,
            authorBotId: specialist.id,
            content: text,
            timestamp: new Date().toISOString(),
          });

          memoryManager.appendRoomMemory(roomId, {
            what: `${specialist.name}: ${text.slice(0, 200)}...`,
            when: new Date().toISOString(),
            why: "Specialist shared intermediate findings",
            where: specialist.name,
            category: "Research Finding",
          });
        }
      }
    }

    // Step 3: Peer Review & Critique Verification
    if (critic && session.turnCount < session.maxTurns && stopEpochOf(conversationId) === epoch) {
      const artifactSummary = session.artifacts.map((a) => `From ${a.name}:\n${a.content}`).join("\n\n---\n\n");

      const critiquePrompt = [
        `[Peer Review & Verification Turn]`,
        `As ${critic.name} (${critic.title}), critically review the intermediate findings produced by your teammates:`,
        artifactSummary,
        "Challenge assumptions, check for risks or missing constraints, and suggest necessary refinements before final consensus. (Keep response concise, max 100 words).",
      ].join("\n\n");

      await runTurn({
        bot: critic,
        conversationId,
        content: critiquePrompt,
        route: { by: "handoff" },
      });

      session.turnCount++;
    }

    session.status = "completed";
    publish({ type: "rooms-changed" });
    return session;
  }
}

export const collaborationEngine = new CollaborationRoomEngine();
