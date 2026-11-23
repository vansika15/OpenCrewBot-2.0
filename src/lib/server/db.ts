// App storage: bots, rooms, and the chat transcript the UI shows. Mastra keeps
// its own store (mastra.db) for each bot's model-facing thread history.
import { createClient, type Client } from "@libsql/client";
import { APP_DB_URL } from "./config";
import type {
  AuditLogEntry,
  Bot,
  ChatMessage,
  ConversationId,
  Room,
  Skill,
  Task,
  TaskPlan,
  Workflow,
  WorkflowRun,
} from "@/lib/shared/types";

// Cached across hot reloads, together with the file it points at, so a
// changed database path opens a fresh connection instead of reusing one
// bound to a file that has moved.
const g = globalThis as unknown as { __opencrewbotDb?: { url: string; schema?: number; client: Promise<Client> } };

/** Bump when a table is added, so a hot-reloaded server re-runs the CREATE statements. */
const SCHEMA_VERSION = 3;

async function open(): Promise<Client> {
  const db = createClient({ url: APP_DB_URL });
  await db.batch(
    [
      "CREATE TABLE IF NOT EXISTS bots (id TEXT PRIMARY KEY, data TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, data TEXT NOT NULL)",
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS messages_by_conversation ON messages (conversation_id, created_at)",
      "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, data TEXT NOT NULL)",
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        generation INTEGER NOT NULL DEFAULT 0,
        last_read_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS task_plans (
        id TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        conversation_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        plan_id TEXT,
        assigned_agent_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS tasks_by_plan ON tasks (plan_id)",
      `CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS runs_by_workflow ON workflow_runs (workflow_id, started_at DESC)",
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        approved INTEGER NOT NULL,
        data TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS audit_by_timestamp ON audit_logs (timestamp DESC)",
      `CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
    ],
    "write",
  );
  return db;
}

export function db(): Promise<Client> {
  const cached = g.__opencrewbotDb;
  if (cached?.url === APP_DB_URL && cached.schema === SCHEMA_VERSION) return cached.client;
  // Close the old connection (an older build cached the bare promise).
  const stale = cached && "client" in cached ? cached.client : (cached as unknown as Promise<Client> | undefined);
  void stale?.then((c) => c.close()).catch(() => {});
  const client = open();
  g.__opencrewbotDb = { url: APP_DB_URL, schema: SCHEMA_VERSION, client };
  return client;
}

// ── settings (small JSON values) ────────────────────────────────────────

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const rows = await (await db()).execute({ sql: "SELECT data FROM settings WHERE key = ?", args: [key] });
  return rows.rows[0] ? (JSON.parse(String(rows.rows[0].data)) as T) : undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).execute({
    sql: "INSERT INTO settings (key, data) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data",
    args: [key, JSON.stringify(value)],
  });
}

// ── bots ────────────────────────────────────────────────────────────────

/** Fill in fields added after a bot was saved, so older rows keep working. */
function normalizeBot(raw: Bot): Bot {
  return {
    ...raw,
    connections: raw.connections ?? [],
  };
}

export async function listBots(): Promise<Bot[]> {
  const rows = await (await db()).execute("SELECT data FROM bots");
  return rows.rows
    .map((r) => normalizeBot(JSON.parse(String(r.data)) as Bot))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getBot(id: string): Promise<Bot | null> {
  const rows = await (await db()).execute({ sql: "SELECT data FROM bots WHERE id = ?", args: [id] });
  return rows.rows[0] ? normalizeBot(JSON.parse(String(rows.rows[0].data)) as Bot) : null;
}

export async function saveBot(bot: Bot): Promise<void> {
  await (await db()).execute({
    sql: "INSERT INTO bots (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
    args: [bot.id, JSON.stringify(bot)],
  });
}

export async function deleteBotRow(id: string): Promise<void> {
  await (await db()).execute({ sql: "DELETE FROM bots WHERE id = ?", args: [id] });
}

// ── rooms ───────────────────────────────────────────────────────────────

export async function listRooms(): Promise<Room[]> {
  const rows = await (await db()).execute("SELECT data FROM rooms");
  return rows.rows
    .map((r) => JSON.parse(String(r.data)) as Room)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getRoom(id: string): Promise<Room | null> {
  const rows = await (await db()).execute({ sql: "SELECT data FROM rooms WHERE id = ?", args: [id] });
  return rows.rows[0] ? (JSON.parse(String(rows.rows[0].data)) as Room) : null;
}

export async function saveRoom(room: Room): Promise<void> {
  await (await db()).execute({
    sql: "INSERT INTO rooms (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
    args: [room.id, JSON.stringify(room)],
  });
}

export async function deleteRoomRow(id: string): Promise<void> {
  await (await db()).execute({ sql: "DELETE FROM rooms WHERE id = ?", args: [id] });
}

// ── messages ────────────────────────────────────────────────────────────

export async function saveMessage(message: ChatMessage): Promise<void> {
  await (await db()).execute({
    sql: `INSERT INTO messages (id, conversation_id, created_at, data) VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    args: [message.id, message.conversationId, message.createdAt, JSON.stringify(message)],
  });
}

export async function listMessages(conversationId: ConversationId, limit = 200): Promise<ChatMessage[]> {
  const rows = await (await db()).execute({
    sql: `SELECT data FROM (
            SELECT data, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?
          ) ORDER BY created_at ASC`,
    args: [conversationId, limit],
  });
  return rows.rows.map((r) => JSON.parse(String(r.data)) as ChatMessage);
}

export async function clearMessages(conversationId: ConversationId): Promise<void> {
  await (await db()).execute({ sql: "DELETE FROM messages WHERE conversation_id = ?", args: [conversationId] });
}

/** The newest message per conversation, for sidebar previews. */
export async function lastMessages(): Promise<Map<ConversationId, ChatMessage>> {
  const rows = await (await db()).execute(
    `SELECT m.data FROM messages m
     JOIN (SELECT conversation_id, MAX(created_at) AS latest FROM messages GROUP BY conversation_id) l
       ON m.conversation_id = l.conversation_id AND m.created_at = l.latest`,
  );
  const out = new Map<ConversationId, ChatMessage>();
  for (const r of rows.rows) {
    const m = JSON.parse(String(r.data)) as ChatMessage;
    out.set(m.conversationId, m);
  }
  return out;
}

export async function unreadCounts(): Promise<Map<ConversationId, number>> {
  const rows = await (await db()).execute(
    `SELECT m.conversation_id AS id, COUNT(*) AS n FROM messages m
     LEFT JOIN conversations c ON c.id = m.conversation_id
     WHERE m.created_at > COALESCE(c.last_read_at, '') AND m.data NOT LIKE '%"role":"user"%'
     GROUP BY m.conversation_id`,
  );
  return new Map(rows.rows.map((r) => [String(r.id), Number(r.n)]));
}

export async function markRead(conversationId: ConversationId): Promise<void> {
  await (await db()).execute({
    sql: `INSERT INTO conversations (id, last_read_at) VALUES (?, ?)
          ON CONFLICT(id) DO UPDATE SET last_read_at = excluded.last_read_at`,
    args: [conversationId, new Date().toISOString()],
  });
}

/** Bumped by "Clear chat" so each bot starts a fresh model-side thread. */
export async function conversationGeneration(conversationId: ConversationId): Promise<number> {
  const rows = await (await db()).execute({
    sql: "SELECT generation FROM conversations WHERE id = ?",
    args: [conversationId],
  });
  return rows.rows[0] ? Number(rows.rows[0].generation) : 0;
}

export async function bumpGeneration(conversationId: ConversationId): Promise<number> {
  await (await db()).execute({
    sql: `INSERT INTO conversations (id, generation) VALUES (?, 1)
          ON CONFLICT(id) DO UPDATE SET generation = generation + 1`,
    args: [conversationId],
  });
  return conversationGeneration(conversationId);
}

// ── task plans & tasks ──────────────────────────────────────────────────

export async function saveTaskPlan(plan: TaskPlan): Promise<void> {
  await (await db()).execute({
    sql: `INSERT INTO task_plans (id, goal, conversation_id, status, created_at, updated_at, data)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            updated_at = excluded.updated_at,
            data = excluded.data`,
    args: [plan.id, plan.goal, plan.conversationId ?? null, plan.status, plan.createdAt, plan.updatedAt, JSON.stringify(plan)],
  });
}

export async function getTaskPlan(id: string): Promise<TaskPlan | null> {
  const rows = await (await db()).execute({ sql: "SELECT data FROM task_plans WHERE id = ?", args: [id] });
  return rows.rows[0] ? (JSON.parse(String(rows.rows[0].data)) as TaskPlan) : null;
}

export async function listTaskPlans(): Promise<TaskPlan[]> {
  const rows = await (await db()).execute("SELECT data FROM task_plans ORDER BY created_at DESC LIMIT 50");
  return rows.rows.map((r) => JSON.parse(String(r.data)) as TaskPlan);
}

export async function deleteTaskPlan(id: string): Promise<void> {
  const client = await db();
  await client.execute({ sql: "DELETE FROM tasks WHERE plan_id = ?", args: [id] });
  await client.execute({ sql: "DELETE FROM task_plans WHERE id = ?", args: [id] });
}

export async function saveTask(task: Task): Promise<void> {
  await (await db()).execute({
    sql: `INSERT INTO tasks (id, plan_id, assigned_agent_id, status, created_at, data)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            data = excluded.data`,
    args: [task.id, task.planId ?? null, task.assignedAgentId, task.status, task.createdAt, JSON.stringify(task)],
  });
}

export async function getTask(id: string): Promise<Task | null> {
  const rows = await (await db()).execute({ sql: "SELECT data FROM tasks WHERE id = ?", args: [id] });
  return rows.rows[0] ? (JSON.parse(String(rows.rows[0].data)) as Task) : null;
}

export async function listTasks(limit = 100): Promise<Task[]> {
  const rows = await (await db()).execute({ sql: "SELECT data FROM tasks ORDER BY created_at DESC LIMIT ?", args: [limit] });
  return rows.rows.map((r) => JSON.parse(String(r.data)) as Task);
}

export async function listTasksByPlan(planId: string): Promise<Task[]> {
  const rows = await (await db()).execute({ sql: "SELECT data FROM tasks WHERE plan_id = ? ORDER BY created_at ASC", args: [planId] });
  return rows.rows.map((r) => JSON.parse(String(r.data)) as Task);
}

export async function deleteTask(id: string): Promise<void> {
  await (await db()).execute({ sql: "DELETE FROM tasks WHERE id = ?", args: [id] });
}

// ── workflows & runs ────────────────────────────────────────────────────

export async function saveWorkflow(workflow: Workflow): Promise<void> {
  await (await db()).execute({
    sql: `INSERT INTO workflows (id, name, enabled, created_at, data)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            enabled = excluded.enabled,
            data = excluded.data`,
    args: [workflow.id, workflow.name, workflow.enabled ? 1 : 0, workflow.createdAt, JSON.stringify(workflow)],
  });
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const rows = await (await db()).execute({ sql: "SELECT data FROM workflows WHERE id = ?", args: [id] });
  return rows.rows[0] ? (JSON.parse(String(rows.rows[0].data)) as Workflow) : null;
}

export async function listWorkflows(): Promise<Workflow[]> {
  const rows = await (await db()).execute("SELECT data FROM workflows ORDER BY created_at DESC");
  return rows.rows.map((r) => JSON.parse(String(r.data)) as Workflow);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const client = await db();
  await client.execute({ sql: "DELETE FROM workflow_runs WHERE workflow_id = ?", args: [id] });
  await client.execute({ sql: "DELETE FROM workflows WHERE id = ?", args: [id] });
}

export async function saveWorkflowRun(run: WorkflowRun): Promise<void> {
  await (await db()).execute({
    sql: `INSERT INTO workflow_runs (id, workflow_id, status, started_at, data)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            data = excluded.data`,
    args: [run.id, run.workflowId, run.status, run.startedAt, JSON.stringify(run)],
  });
}

export async function listWorkflowRuns(workflowId?: string, limit = 50): Promise<WorkflowRun[]> {
  const client = await db();
  const rows = workflowId
    ? await client.execute({ sql: "SELECT data FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?", args: [workflowId, limit] })
    : await client.execute({ sql: "SELECT data FROM workflow_runs ORDER BY started_at DESC LIMIT ?", args: [limit] });
  return rows.rows.map((r) => JSON.parse(String(r.data)) as WorkflowRun);
}

// ── audit logs ──────────────────────────────────────────────────────────

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  await (await db()).execute({
    sql: `INSERT INTO audit_logs (id, timestamp, actor, action, resource, approved, data)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [entry.id, entry.timestamp, entry.actor, entry.action, entry.resource, entry.approved ? 1 : 0, JSON.stringify(entry)],
  });
}

export async function listAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  const rows = await (await db()).execute({ sql: "SELECT data FROM audit_logs ORDER BY timestamp DESC LIMIT ?", args: [limit] });
  return rows.rows.map((r) => JSON.parse(String(r.data)) as AuditLogEntry);
}

// ── skills ──────────────────────────────────────────────────────────────

export async function saveSkill(skill: Skill): Promise<void> {
  await (await db()).execute({
    sql: `INSERT INTO skills (id, name, category, enabled, created_at, data)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            category = excluded.category,
            enabled = excluded.enabled,
            data = excluded.data`,
    args: [skill.id, skill.name, skill.category, skill.enabled ? 1 : 0, skill.createdAt, JSON.stringify(skill)],
  });
}

export async function getSkill(id: string): Promise<Skill | null> {
  const rows = await (await db()).execute({ sql: "SELECT data FROM skills WHERE id = ?", args: [id] });
  return rows.rows[0] ? (JSON.parse(String(rows.rows[0].data)) as Skill) : null;
}

export async function listSkills(): Promise<Skill[]> {
  const rows = await (await db()).execute("SELECT data FROM skills ORDER BY name ASC");
  return rows.rows.map((r) => JSON.parse(String(r.data)) as Skill);
}

export async function deleteSkill(id: string): Promise<void> {
  await (await db()).execute({ sql: "DELETE FROM skills WHERE id = ?", args: [id] });
}

