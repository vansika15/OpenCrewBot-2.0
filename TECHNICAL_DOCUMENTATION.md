# OpenCrewBot 2.0 — Technical Documentation

**System:** OpenCrewBot 2.0 — Autonomous Enterprise AI Workforce Operating System  
**Framework:** Next.js 16.4.0 (App Router, Turbopack, React 19.3.0, TypeScript 5.9.3, Tailwind CSS v4)  
**Persistence:** LibSQL SQLite (`opencrewbot.db`, `mastra.db`) + Filesystem Markdown Memory  
**Target Enterprise Testbed:** MeetUniversity (Aspirations, Study Abroad, School Partnerships)  
**License:** MIT License (© 2026 Studio1HQ & Contributors)

---

## 1. System Architecture & Directory Structure

```
OpenCrewBot/
├── src/
│   ├── app/                         # Next.js 16 App Router
│   │   ├── api/                     # 27 Specialized REST API Routes
│   │   │   ├── agent-factory/       # Dynamic Natural-Language Agent Factory
│   │   │   ├── approvals/           # 3-Tier Security Approval Centre
│   │   │   ├── audit-logs/          # Immutable Audit Trail
│   │   │   ├── bootstrap/           # Initial Workspace State Loader
│   │   │   ├── bots/                # Agent CRUD & Workspace Handlers
│   │   │   ├── conversations/       # Chat Transcripts, Approvals, SSE Streams
│   │   │   ├── integrations/        # GitHub, Notion, Email Integrations
│   │   │   ├── memory/              # Multi-Tier Memory (Project, Room, Agent)
│   │   │   ├── models/              # Model Catalog & Cost Analytics
│   │   │   ├── orchestrate/         # Intelligent Chief of Staff Entrypoint
│   │   │   ├── rooms/               # Collaboration Rooms
│   │   │   ├── skills/              # Reusable Skills Execution
│   │   │   ├── tasks/               # Task DAG Engine & Plan Management
│   │   │   └── workflows/           # Scheduled Automation Engine
│   │   ├── layout.tsx               # Root Layout
│   │   └── page.tsx                 # Main Application Page
│   ├── components/                  # React 19 Client Components
│   │   ├── OpenCrewBotApp.tsx       # Core Application State & Provider
│   │   ├── Sidebar.tsx              # Workforce Sidebar & Navigation Bar
│   │   ├── ChatView.tsx             # SSE Chat Transcript View
│   │   ├── Inspector.tsx            # Inspector Pane (Details, Memory, Settings)
│   │   ├── Message.tsx              # Tool Chips, Questions, Approval Buttons
│   │   └── WorkforcePanels.tsx      # Workforce Drawers: Tasks, Approvals, Workflows, Skills, Memory, Factory
│   └── lib/
│       ├── client/                  # Client API & Store
│       ├── server/                  # Core Backend Subsystems
│       │   ├── agent-factory/       # Dynamic Agent Synthesizer
│       │   ├── collaboration/       # Room Collaboration Engine & Loop Prevention
│       │   ├── integrations/        # GitHub, Notion, Email Integrations
│       │   ├── llm/                 # Multi-Model Router & Cost Analytics
│       │   ├── memory/              # Multi-Tier Memory Engine & Provenance
│       │   ├── orchestration/       # Chief of Staff Task Decomposer & Synthesizer
│       │   ├── scheduler/           # Background Interval Workflow Engine
│       │   ├── security/            # 3-Tier Autonomy & Approval Centre
│       │   ├── skills/              # 8 Modular Reusable Skills
│       │   ├── tasks/               # Task DAG Execution Engine
│       │   ├── db.ts                # LibSQL SQLite Persistence
│       │   └── runtime.ts           # Mastra AgentController Session Engine
│       └── shared/                  # Shared JSON Types
├── tests/                           # Automated Verification & Test Suites
│   ├── demonstrations.ts            # MeetUniversity 7 Business Scenarios Test Runner
│   └── unit_and_integration.ts      # 10/10 Core Subsystems Test Suite
├── test_evidence/                   # Verifiable Test & Demonstration Logs
└── data/                            # Persistent Application State
    ├── opencrewbot.db               # SQLite Metadata Database
    ├── project/PROJECT_MEMORY.md    # Global Enterprise Project Memory
    ├── rooms/<id>/ROOM_MEMORY.md    # Shared Collaboration Room Memory
    ├── workspaces/<id>/MEMORY.md    # Individual Agent Memory
    ├── synced_docs/                 # Notion / Doc Sync Output
    └── outbox/                      # Email Dispatch Records
```

---

## 2. Database Schema (LibSQL / SQLite)

The SQLite database (`data/opencrewbot.db`) manages persistent entities across hot reloads and process restarts:

1. **`bots`**: `(id TEXT PRIMARY KEY, data TEXT)` — Stores name, handle, title, instructions, model, tools, approval tier, color, emoji.
2. **`rooms`**: `(id TEXT PRIMARY KEY, data TEXT)` — Stores name, topic, member IDs, lead bot ID, responder strategy.
3. **`messages`**: `(id TEXT PRIMARY KEY, conversation_id TEXT, created_at TEXT, data TEXT)` — Stores full chat transcripts, tool calls, and model usage tokens.
4. **`task_plans`**: `(id TEXT PRIMARY KEY, goal TEXT, conversation_id TEXT, status TEXT, created_at TEXT, updated_at TEXT, data TEXT)` — Stores Chief of Staff goals, task DAGs, and consolidated deliverables.
5. **`tasks`**: `(id TEXT PRIMARY KEY, plan_id TEXT, assigned_agent_id TEXT, status TEXT, created_at TEXT, data TEXT)` — Tracks individual subtask state, dependencies, retry counts, inputs, and outputs.
6. **`workflows`**: `(id TEXT PRIMARY KEY, name TEXT, enabled INTEGER, created_at TEXT, data TEXT)` — Stores recurring automation routines and intervals.
7. **`workflow_runs`**: `(id TEXT PRIMARY KEY, workflow_id TEXT, status TEXT, started_at TEXT, data TEXT)` — Logs historical workflow runs and outputs.
8. **`audit_logs`**: `(id TEXT PRIMARY KEY, timestamp TEXT, actor TEXT, action TEXT, resource TEXT, approved INTEGER, data TEXT)` — Immutable log of all security decisions, task executions, and approvals.
9. **`skills`**: `(id TEXT PRIMARY KEY, name TEXT, category TEXT, enabled INTEGER, created_at TEXT, data TEXT)` — Modular skills registry.
10. **`settings`**: `(key TEXT PRIMARY KEY, data TEXT)` — Configuration and connection versions.

---

## 3. Core API Documentation

### Chief of Staff Orchestration
- **`POST /api/orchestrate`**
  - **Body:** `{ "goal": string, "conversationId"?: string }`
  - **Response:** `{ "plan": TaskPlan }`
  - **Behavior:** Decomposes request into DAG subtasks, runs parallel and sequential subtasks across agents, and synthesizes a final executive deliverable.

### Dynamic Agent Factory
- **`POST /api/agent-factory`**
  - **Body:** `{ "prompt": string, "preferredModel"?: string, "permissionLevel"?: "ask" | "controlled" | "full" }`
  - **Response:** `{ "bot": Bot, "suggestedSkills": string[], "reasoning": string }`
  - **Behavior:** Synthesizes persona, instructions, tools, permissions, and initializes workspace memory without modifying source code.

### Task Execution Engine
- **`GET /api/tasks`**: Returns all tasks and plans (supports `?planId=...`).
- **`POST /api/tasks`**: Creates and schedules a new Task Plan.
- **`PATCH /api/tasks/:id`**: Approves, rejects, or updates task state.

### Multi-Tier Memory
- **`GET /api/memory?scope=project|room|bot&id=...`**: Fetches Markdown memory and file path.
- **`PUT /api/memory`**: Saves updated memory content.
- **`PATCH /api/memory`**: `{ "scope": string, "id"?: string, "find": string, "replace": string }` — Performs exact text correction (Demonstration 6).

### 3-Tier Security & Approval Centre
- **`GET /api/approvals?all=true|false`**: Lists pending or all approval requests.
- **`POST /api/approvals`**: `{ "id": string, "approve": boolean, "reason"?: string }` — Records human approval or strict rejection.
- **`GET /api/audit-logs`**: Retrieves the immutable audit log trail.

### Scheduled AI Workflows
- **`GET /api/workflows`**: Lists workflows and recent execution runs.
- **`POST /api/workflows`**: Creates a new scheduled routine.
- **`PATCH /api/workflows/:id`**: Toggles pause/resume or triggers manual execution (`action: "trigger"`).

---

## 4. Setup and Installation

### Prerequisites
- Node.js `v20+` or `v24+` (tested on Node v24.16.0)
- `pnpm` (v11 or v12) or `npm`
- Git

### Installation Commands
```bash
# Clone the repository
git clone https://github.com/Studio1-OSS/OpenCrewBot.git
cd OpenCrewBot

# Install dependencies
pnpm install

# Run the development server
pnpm dev
```
Open `http://127.0.0.1:3000` in your web browser.

### Running Automated Test Suites
```bash
# Run unit & integration test suite (10/10 tests)
npx tsx tests/unit_and_integration.ts

# Run the complete 7 MeetUniversity business demonstrations
npx tsx tests/demonstrations.ts
```
All evidence is automatically saved in `test_evidence/`.
