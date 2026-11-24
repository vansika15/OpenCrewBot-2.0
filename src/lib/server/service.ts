// What the API routes call. Keeps validation and side effects in one place.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Bot, BotInput, ChatMessage, ConversationId, ConversationSummary, Room, RoomInput } from "@/lib/shared/types";
import { DATA_DIR } from "./config";
import { InputError } from "./errors";
import * as store from "./db";
import { publish } from "./bus";
import { DEFAULT_MODEL } from "./models";
import { deleteWorkspace, writeMemory } from "./memory-files";
import { forgetConversation, resetBot, runTurn, runningBots, stopConversation } from "./runtime";
import { messagePreview } from "@/lib/shared/preview";
import { roomConversationId, runRoom } from "./rooms";

export { InputError };

// ── seeding and restart cleanup (once per process) ──────────────────────

const g = globalThis as unknown as { __opencrewbotBoot?: Promise<void> };

export function boot(): Promise<void> {
  g.__opencrewbotBoot ??= (async () => {
    await sweepInterrupted();
    await seed();
  })();
  return g.__opencrewbotBoot;
}

/** A turn that was streaming when the server stopped can't resume. Say so. */
async function sweepInterrupted() {
  const client = await store.db();
  const rows = await client.execute(`SELECT data FROM messages WHERE data LIKE '%"status":"streaming"%'`);
  for (const r of rows.rows) {
    const m = JSON.parse(String(r.data)) as ChatMessage;
    if (m.status !== "streaming") continue;
    m.status = "stopped";
    m.error = "Interrupted by a server restart.";
    for (const p of m.parts) if (p.kind === "tool" && (p.status === "running" || p.status === "awaiting-approval")) p.status = "denied";
    await store.saveMessage(m);
  }
}

const SEED_MARKER = join(DATA_DIR, ".seeded");

async function seed() {
  const existingBots = await store.listBots();
  const botMap = new Map(existingBots.map((b) => [b.name.toLowerCase(), b]));
  const tools = { webSearch: true, memory: true, codeMode: false, browser: false, askUser: true };

  const getOrCreate = async (input: BotInput) => {
    const found = botMap.get(input.name.toLowerCase());
    if (found) return found;
    const created = await createBot(input);
    botMap.set(created.name.toLowerCase(), created);
    return created;
  };

  const scout = await getOrCreate({
    name: "Scout",
    title: "Research & Intelligence",
    description: "Finds things out on the web and comes back with sourced answers.",
    instructions: "Research before answering anything time-sensitive. Search, read sources, and answer with clear citations.",
    emoji: "🔭",
    color: "#2f7df6",
    model: DEFAULT_MODEL,
    tools: { ...tools, codeMode: true },
    approval: "ask",
    pinned: true,
  });

  const quill = await getOrCreate({
    name: "Quill",
    title: "Writing & Content Creation",
    description: "Turns notes and research into clear posts, docs, campaigns, and emails.",
    instructions: "Write in plain, specific language. Match tone, craft persuasive narratives, and offer tight drafts.",
    emoji: "✒️",
    color: "#e0663d",
    model: DEFAULT_MODEL,
    tools: { ...tools, webSearch: false },
    approval: "ask",
    pinned: false,
  });

  const atlas = await getOrCreate({
    name: "Atlas",
    title: "Chief of Staff & Planning",
    description: "Breaks goals into steps, coordinates workforce agents, explains software systems, and synthesizes deliverables.",
    instructions: "Serve as the Chief of Staff. Turn business and technical goals into structured plans, explain software, technology, and architecture concepts, coordinate workforce agents, and provide direct, comprehensive answers to technical and operational inquiries.",
    emoji: "🧭",
    color: "#1f9d6b",
    model: DEFAULT_MODEL,
    tools,
    approval: "ask",
    pinned: true,
  });

  const radar = await getOrCreate({
    name: "Radar",
    title: "Competitive Intelligence",
    description: "Analyzes competitor product offerings, public pricing, customer segments, and positioning gaps.",
    instructions: "Conduct structured competitor benchmarking, pricing teardowns, and strategic differentiation matrices.",
    emoji: "🎯",
    color: "#0ea5e9",
    model: DEFAULT_MODEL,
    tools: { ...tools, codeMode: true },
    approval: "ask",
    pinned: false,
  });

  const ledger = await getOrCreate({
    name: "Ledger",
    title: "Financial Modelling & Unit Economics",
    description: "Builds unit economics models, CAC/LTV projections, and financial impact analyses.",
    instructions: "Calculate precise financial formulas. Provide revenue run-rate breakdowns, margins, and sensitivity models.",
    emoji: "📊",
    color: "#10b981",
    model: DEFAULT_MODEL,
    tools: { ...tools, codeMode: true },
    approval: "ask",
    pinned: false,
  });

  const cadence = await getOrCreate({
    name: "Cadence",
    title: "Growth & Campaign Strategist",
    description: "Develops go-to-market strategies, campaign roadmaps, and high-converting marketing collateral.",
    instructions: "Design high-converting campaigns, 30-day content calendars, and targeted student/partner acquisition funnels.",
    emoji: "🚀",
    color: "#f59e0b",
    model: DEFAULT_MODEL,
    tools,
    approval: "ask",
    pinned: false,
  });

  const metric = await getOrCreate({
    name: "Metric",
    title: "Senior Data Analyst",
    description: "Extracts insights, conversion funnels, and statistical trends from raw business datasets.",
    instructions: "Perform rigorous tabular data calculations, identify conversion drop-off bottlenecks, and calculate revenue impact.",
    emoji: "📈",
    color: "#6366f1",
    model: DEFAULT_MODEL,
    tools: { ...tools, codeMode: true },
    approval: "ask",
    pinned: false,
  });

  const forge = await getOrCreate({
    name: "Forge",
    title: "Principal Software Architect",
    description: "Inspects codebases, identifies technical issues, and recommends prioritized engineering improvements.",
    instructions: "Inspect repositories, identify code and dependency flaws, and prepare development plans. Request approval before applying changes.",
    emoji: "⚡",
    color: "#8b5cf6",
    model: DEFAULT_MODEL,
    tools: { ...tools, codeMode: true },
    approval: "ask",
    pinned: false,
  });

  // Rooms (4 required)
  const existingRooms = await store.listRooms();
  const roomMap = new Map(existingRooms.map((r) => [r.name.toLowerCase(), r]));

  const getOrCreateRoom = async (input: RoomInput) => {
    const found = roomMap.get(input.name.toLowerCase());
    if (found) return found;
    return createRoom(input);
  };

  await getOrCreateRoom({
    name: "Executive Suite",
    topic: "Strategic alignment and Chief of Staff coordination",
    emoji: "🎬",
    memberIds: [atlas.id, scout.id, ledger.id, cadence.id],
    leadId: atlas.id,
    responder: "auto",
    pinned: true,
  });

  await getOrCreateRoom({
    name: "Market Intelligence",
    topic: "Competitive landscape, pricing benchmarking & positioning",
    emoji: "🔭",
    memberIds: [radar.id, scout.id, metric.id],
    leadId: radar.id,
    responder: "auto",
    pinned: true,
  });

  await getOrCreateRoom({
    name: "Growth & Campaigns Hub",
    topic: "Class 11 Aspirations campaign & student acquisition",
    emoji: "🚀",
    memberIds: [cadence.id, quill.id, metric.id],
    leadId: cadence.id,
    responder: "auto",
    pinned: false,
  });

  await getOrCreateRoom({
    name: "Engineering Review",
    topic: "Code audits, repository security, and technical backlog",
    emoji: "⚡",
    memberIds: [forge.id, atlas.id, scout.id],
    leadId: forge.id,
    responder: "auto",
    pinned: false,
  });

  writeFileSync(SEED_MARKER, new Date().toISOString());
}

// ── bots ────────────────────────────────────────────────────────────────

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "bot";
}

async function uniqueHandle(wanted: string, exceptId?: string): Promise<string> {
  const taken = new Set((await store.listBots()).filter((b) => b.id !== exceptId).map((b) => b.handle));
  const base = slug(wanted);
  let handle = base;
  for (let n = 2; taken.has(handle) || ["everyone", "all"].includes(handle); n++) handle = `${base}${n}`;
  return handle;
}

function validateBot(input: Partial<BotInput>) {
  if (input.name !== undefined && !input.name.trim()) throw new InputError("A bot needs a name.");
  if (input.name && input.name.length > 40) throw new InputError("Keep the name under 40 characters.");
  if (input.instructions && input.instructions.length > 8000) throw new InputError("Instructions are limited to 8,000 characters.");
}

export async function createBot(input: BotInput): Promise<Bot> {
  validateBot(input);
  const bot: Bot = {
    ...input,
    id: randomUUID().slice(0, 8),
    name: input.name.trim(),
    connections: input.connections ?? [],
    handle: await uniqueHandle(input.handle || input.name),
    createdAt: new Date().toISOString(),
  };
  await store.saveBot(bot);
  writeMemory(bot.id, `# ${bot.name}'s memory\n\n`);
  publish({ type: "bots-changed" });
  return bot;
}

export async function updateBot(id: string, patch: Partial<BotInput>): Promise<Bot> {
  const bot = await store.getBot(id);
  if (!bot) throw new InputError("That bot doesn't exist.");
  validateBot(patch);
  const next: Bot = {
    ...bot,
    ...patch,
    id: bot.id,
    createdAt: bot.createdAt,
    tools: { ...bot.tools, ...(patch.tools ?? {}) },
    handle: patch.handle !== undefined || patch.name !== undefined ? await uniqueHandle(patch.handle || patch.name || bot.handle, id) : bot.handle,
  };
  await store.saveBot(next);
  await resetBot(id);
  publish({ type: "bots-changed" });
  return next;
}

export async function deleteBot(id: string): Promise<void> {
  await stopConversation(`dm:${id}`);
  await resetBot(id);
  await store.deleteBotRow(id);
  await store.clearMessages(`dm:${id}`);
  for (const room of await store.listRooms()) {
    if (!room.memberIds.includes(id)) continue;
    const memberIds = room.memberIds.filter((m) => m !== id);
    await store.saveRoom({ ...room, memberIds, leadId: room.leadId === id ? (memberIds[0] ?? null) : room.leadId });
  }
  deleteWorkspace(id);
  publish({ type: "bots-changed" });
  publish({ type: "rooms-changed" });
}

// ── rooms ───────────────────────────────────────────────────────────────

async function cleanRoomInput<T extends Partial<RoomInput>>(input: T): Promise<T> {
  if (input.name !== undefined && !input.name.trim()) throw new InputError("A room needs a name.");
  if (input.memberIds) {
    const known = new Set((await store.listBots()).map((b) => b.id));
    input.memberIds = [...new Set(input.memberIds)].filter((id) => known.has(id));
  }
  return input;
}

export async function createRoom(input: RoomInput): Promise<Room> {
  const clean = await cleanRoomInput(input);
  const room: Room = {
    ...clean,
    id: randomUUID().slice(0, 8),
    name: clean.name.trim(),
    leadId: clean.leadId && clean.memberIds.includes(clean.leadId) ? clean.leadId : (clean.memberIds[0] ?? null),
    createdAt: new Date().toISOString(),
  };
  await store.saveRoom(room);
  publish({ type: "rooms-changed" });
  return room;
}

export async function updateRoom(id: string, patch: Partial<RoomInput>): Promise<Room> {
  const room = await store.getRoom(id);
  if (!room) throw new InputError("That room doesn't exist.");
  const clean = await cleanRoomInput(patch);
  const next: Room = { ...room, ...clean, id: room.id, createdAt: room.createdAt };
  if (!next.leadId || !next.memberIds.includes(next.leadId)) next.leadId = next.memberIds[0] ?? null;
  await store.saveRoom(next);
  publish({ type: "rooms-changed" });
  return next;
}

export async function deleteRoom(id: string): Promise<void> {
  const conversationId = roomConversationId(id);
  await stopConversation(conversationId);
  await store.deleteRoomRow(id);
  await store.clearMessages(conversationId);
  publish({ type: "rooms-changed" });
}

// ── conversations ───────────────────────────────────────────────────────

function parseConversation(conversationId: ConversationId): { kind: "dm" | "room"; id: string } {
  const [kind, id] = conversationId.split(":");
  if ((kind !== "dm" && kind !== "room") || !id) throw new InputError("Unknown conversation.");
  return { kind, id };
}

export async function sendMessage(conversationId: ConversationId, text: string): Promise<ChatMessage> {
  const content = text.trim();
  if (!content) throw new InputError("Type a message first.");
  if (content.length > 20000) throw new InputError("Messages are limited to 20,000 characters.");
  const { kind, id } = parseConversation(conversationId);

  const bot = kind === "dm" ? await store.getBot(id) : null;
  const room = kind === "room" ? await store.getRoom(id) : null;
  if (kind === "dm" && !bot) throw new InputError("That bot doesn't exist.");
  if (kind === "room" && !room) throw new InputError("That room doesn't exist.");
  if (room && room.memberIds.length === 0) throw new InputError("Add at least one bot to this room first.");

  // Prevent rapid duplicate submission (e.g., accidental double-click within 2000ms)
  const recent = await store.listMessages(conversationId, 5);
  const now = Date.now();
  const duplicate = recent.find((m) => {
    if (m.role !== "user") return false;
    const msgTime = new Date(m.createdAt).getTime();
    if (now - msgTime > 2000) return false;
    const text = m.parts
      .filter((p) => p.kind === "text")
      .map((p) => (p as { text: string }).text)
      .join("\n");
    return text === content;
  });
  if (duplicate) {
    return duplicate;
  }

  const message: ChatMessage = {
    id: randomUUID(),
    conversationId,
    role: "user",
    createdAt: new Date().toISOString(),
    status: "done",
    parts: [{ kind: "text", text: content }],
  };
  await store.saveMessage(message);
  await store.markRead(conversationId);
  publish({ type: "message", message });

  // The reply streams over SSE; the request returns as soon as it's queued.
  if (bot) void runTurn({ bot, conversationId, content }).catch(() => {});
  if (room) void runRoom(room, message).catch(() => {});
  return message;
}

export async function clearConversation(conversationId: ConversationId): Promise<void> {
  parseConversation(conversationId);
  await stopConversation(conversationId);
  await store.clearMessages(conversationId);
  await store.bumpGeneration(conversationId);
  forgetConversation(conversationId);
}

export async function summaries(): Promise<ConversationSummary[]> {
  const [bots, rooms, last, unread] = await Promise.all([store.listBots(), store.listRooms(), store.lastMessages(), store.unreadCounts()]);
  const names = new Map(bots.map((b) => [b.id, b.name]));
  const ids = [...bots.map((b) => `dm:${b.id}`), ...rooms.map((r) => roomConversationId(r.id))];
  return ids.map((id) => {
    const m = last.get(id);
    return {
      id,
      running: runningBots(id),
      unread: unread.get(id) ?? 0,
      lastMessage: m
        ? {
            text: messagePreview(m),
            createdAt: m.createdAt,
            author: m.role === "user" ? "You" : (names.get(m.botId ?? "") ?? "Bot"),
          }
        : undefined,
    };
  });
}
