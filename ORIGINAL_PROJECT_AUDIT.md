# Original Project Audit — OpenCrewBot (Commit 4784e3a)

**Repository Source:** [Studio1-OSS/OpenCrewBot](https://github.com/Studio1-OSS/OpenCrewBot)  
**License:** MIT License (© 2026 Studio1HQ)  
**Audit Date:** November 2026  
**Auditor:** Autonomous Senior AI Engineer & Technical Lead  
**Target Submission:** OpenCrewBot 2.0 — Autonomous AI Workforce (EDXSO AI Engineer Intern Assignment 3)

---

## 1. Executive Summary

The original **OpenCrewBot** repository provides a clean, modern web application for hosting conversations with AI bots in direct messages and simple group rooms. It is built on **Next.js 16 (App Router / Turbopack)**, **React 19**, and the **Mastra AI framework (`@mastra/core`)**.

While the repository has a solid UI foundation and incorporates modern agent concepts (such as Mastra AgentController, LibSQL persistence, and Markdown-based bot memory), it is currently a **conversational chat interface with basic tool invocation**, rather than an **autonomous, self-organizing AI workforce**.

### Core Architecture Overview
```
┌────────────────────────────────────────────────────────────┐
│                    Next.js 16 Frontend                     │
│  (React 19, Tailwind CSS, SSE Client, Inspector Panels)    │
└─────────────────────────────┬──────────────────────────────┘
                              │ HTTP / SSE (/api/events)
┌─────────────────────────────▼──────────────────────────────┐
│                    Next.js API Routes                      │
│   /api/bots, /api/rooms, /api/conversations, /api/models   │
└──────────────┬──────────────────────────────┬──────────────┘
               │                              │
┌──────────────▼─────────────┐ ┌──────────────▼──────────────┐
│   LibSQL / SQLite Engine   │ │     Mastra Agent Engine     │
│   (opencrewbot.db metadata │ │  (@mastra/core runtime,     │
│    messages, rooms, bots)  │ │   QuickJS isolate, Nebius)  │
└──────────────┬─────────────┘ └──────────────┬──────────────┘
               │                              │
┌──────────────▼─────────────┐ ┌──────────────▼──────────────┐
│    Workspaces Memory       │ │  Optional Cloud Connectors  │
│  (data/workspaces/<botId>/ │ │  (Composio, Browserbase,    │
│         MEMORY.md)         │ │   remote MCP, Tavily)       │
└────────────────────────────┘ └─────────────────────────────┘
```

---

## 2. Comprehensive Codebase Inventory

| Component / Subsystem | Files | Purpose | Implementation Status |
| :--- | :--- | :--- | :--- |
| **Database & Persistence** | `src/lib/server/db.ts`<br>`src/lib/server/config.ts` | LibSQL SQLite database (`opencrewbot.db`, `mastra.db`) storing bots, rooms, messages, settings. | **Fully Implemented** for basic chat; lacks task DAGs, workflows, skills, audit logs. |
| **Agent Runtime** | `src/lib/server/runtime.ts` | Mastra `AgentController` session manager, TurnFolder event reducer, SSE message streaming. | **Partially Implemented**; only executes single conversational turns per bot. |
| **Room Collaboration** | `src/lib/server/rooms.ts`<br>`src/lib/server/jev.ts` | Multi-agent rooms with `@mention` handoffs (max depth 2) and Jev model router. | **Partially Implemented**; lacks task division, peer review, and structured collaboration. |
| **Memory System** | `src/lib/server/memory-files.ts` | Per-bot `MEMORY.md` file in `data/workspaces/<botId>/`. `memory_add` & `memory_edit` tools. | **Partially Implemented**; lacks room memory, project memory, decision tracking, and provenance. |
| **Models & Providers** | `src/lib/server/models.ts`<br>`src/lib/server/mock-model.ts` | Nebius Token Factory catalog and scripted fallback mock model. | **Partially Implemented**; hardcoded to Nebius and scripted mock; lacks multi-provider support. |
| **Tools & Sandbox** | `src/lib/server/tools.ts` | Tavily web search, QuickJS TypeScript code runner, Browserbase CDP browser. | **Partially Implemented**; lacks extensible skills framework and local safe execution tools. |
| **Connections & MCP** | `src/lib/server/connectors.ts`<br>`src/lib/server/composio.ts`<br>`src/lib/server/mcp-servers.ts` | Composio OAuth app connectors and remote MCP server registry. | **Partially Implemented**; relies heavily on external third-party hosted keys. |
| **Approvals & Autonomy** | `src/lib/server/runtime.ts`<br>`src/components/ChatView.tsx` | Binary `ask` vs `full` mode per bot; pauses execution for inline chat prompt. | **Partially Implemented**; lacks 3-tier autonomy, audit logs, and approval center. |
| **Frontend UI** | `src/components/OpenCrewBotApp.tsx`<br>`src/components/ChatView.tsx`<br>`src/components/Inspector.tsx`<br>`src/components/Sidebar.tsx` | Modern dark-mode responsive dashboard with chat stream and inspector. | **Fully Implemented** for chat; lacks Task, Workflow, Skills, and Approval dashboards. |
| **Testing Suite** | *None* | No automated unit, integration, or end-to-end tests exist in the repository. | **Missing** (0 tests). |

---

## 3. Detailed Audit by Capability

### 3.1 Agent Routing & Orchestration
- **Existing Logic:** When a user posts in a room, `decideResponders` checks for `@mention`, `@everyone`, or calls Jev System One classifier. If Jev is unconfigured, it routes to `room.leadId`.
- **Limitation:** There is no planning phase. The prompt is simply passed as conversational text to the chosen bot. The bot cannot formulate sub-tasks, schedule parallel workers, or aggregate results.

### 3.2 Dynamic Agent Creation
- **Existing Logic:** UI contains `NewBotDrawer` (`BotForms.tsx`) where a user manually types name, instructions, picks an emoji, selects tools, and picks an approval mode.
- **Limitation:** There is no natural-language agent creation ("Agent Factory"). Users cannot describe a desired role in plain English and have the system synthesize instructions, skills, model selection, and permissions.

### 3.3 Multi-Agent Collaboration
- **Existing Logic:** Bots can @mention each other up to `MAX_HANDOFF_DEPTH = 2`. The mentioned bot sees the last 30 lines of chat history.
- **Limitation:** No support for structured debate, cross-verification, task delegation, intermediate artifact sharing, or rollback upon failure.

### 3.4 Task Execution Engine
- **Existing Logic:** Non-existent. Execution is strictly message-by-message streaming.
- **Limitation:** No concept of tasks, status (`pending`, `running`, `completed`, `failed`), dependencies, retries, cancellation, or execution history.

### 3.5 Memory System
- **Existing Logic:** Each bot has a local `MEMORY.md` file loaded into its system prompt (up to 200 lines / 16KB). Redacts secrets using regex patterns.
- **Limitation:** Only individual bot memory exists. No shared project memory, no room memory, no structured provenance (timestamp, origin, reason), and no UI to search or edit project-wide knowledge.

### 3.6 Tooling & Skills
- **Existing Logic:** Hardcoded tools: `web_search`, `read_page`, `crawl_site` (Tavily), `execute_typescript` (QuickJS), `browser_*` (Browserbase), `memory_add`, `memory_edit`, `ask_user`.
- **Limitation:** No concept of modular, composable "Skills" (Market Research, Financial Modeling, Presentation Creation, etc.) that can be attached dynamically to agents.

### 3.7 Human Approvals & Permissions
- **Existing Logic:** Binary `approval: "ask" | "full"`. If "ask", tools in categories `mcp` and `execute` trigger a suspended state requiring an inline chat click ("Allow once" / "Deny").
- **Limitation:** Does not implement the required 3 permission levels (Ask First, Controlled Access, Full Access). No action diff previews, no audit logging, and no centralized Approval Centre.

### 3.8 Scheduled Workflows
- **Existing Logic:** Non-existent.
- **Limitation:** No recurring automation engine, no cron triggers, no execution logs.

### 3.9 Multi-Model Intelligence
- **Existing Logic:** Model list is fetched from Nebius Token Factory. If `NEBIUS_API_KEY` is not present, all bots fall back to `MastraLanguageModelV2Mock`.
- **Limitation:** Locked to Nebius API format or the scripted mock. Cannot connect to OpenAI, Anthropic, Google Gemini, Ollama, Groq, or local endpoints.

---

## 4. Security & Safety Evaluation

1. **Secrets Redaction:** `memory-files.ts` contains `redactSecrets()` which prevents bot memory from storing API keys.
2. **Code Execution Isolation:** Code Mode runs inside a WebAssembly QuickJS isolate with 128MB memory limit, blocking native OS system calls.
3. **Vulnerabilities Identified:**
   - Next.js version 16.4.0 has an advisory notice requiring an upgrade or acknowledgement.
   - API endpoints lack authentication tokens (designed for single-user local host deployment).
   - Tool execution denial in Mastra marks status as "denied", but persistent audit trails are not recorded in SQLite.

---

## 5. Conclusion & Extension Viability

The OpenCrewBot codebase provides an exceptional, clean foundation. Extending it directly preserves its MIT heritage and modern React 19 / Next.js 16 stack while allowing us to build the missing enterprise workforce capabilities:
1. Orchestration Engine & Chief of Staff (`src/lib/server/orchestration/`)
2. Natural Language Agent Factory (`src/lib/server/agent-factory/`)
3. Task DAG Execution Engine (`src/lib/server/tasks/`)
4. Three-Tier Memory Architecture (`src/lib/server/memory/`)
5. Reusable Skills Registry (`src/lib/server/skills/`)
6. Three-Level Permissions & Approval Centre (`src/lib/server/security/`)
7. Workflow Scheduler Engine (`src/lib/server/scheduler/`)
8. Multi-Provider LLM Engine (`src/lib/server/llm/`)
9. Working Integrations (GitHub, Local Doc/Notion sync, Email/Communication Dispatcher)
10. Extended Business UI & Management Views
