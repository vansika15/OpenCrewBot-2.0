# Live vs. Mocked / Simulated Features — OpenCrewBot 2.0

This document provides transparent disclosure distinguishing fully live features from local safe-mode/mocked features.

---

## Feature Matrix

| Subsystem / Feature | Live Mode Capabilities | Local Safe / Mock Mode Capabilities | Current Default Behavior |
| :--- | :--- | :--- | :--- |
| **Chief of Staff Orchestrator** | **100% Live.** Dynamically parses instructions, generates Task DAGs, coordinates agents, and synthesizes reports. | Operates identically in both modes. | **Live** |
| **Dynamic Agent Factory** | **100% Live.** Synthesizes personas, tool configurations, permissions, and writes to SQLite. | Operates identically in both modes. | **Live** |
| **Task DAG Execution Engine** | **100% Live.** Manages task state machine, dependency resolution, retries, and timeouts. | Operates identically in both modes. | **Live** |
| **Multi-Tier Memory Architecture** | **100% Live.** Directly reads/writes to `PROJECT_MEMORY.md`, `ROOM_MEMORY.md`, and `MEMORY.md`. | Operates identically in both modes. | **Live** |
| **8 Reusable Skills** | **100% Live.** Performs real calculations (financial formulas, conversion funnel drops, ICP qualification). | Operates identically in both modes. | **Live** |
| **3-Tier Security & Approval Centre** | **100% Live.** Enforces `ask`, `controlled`, and `full` tiers. Staged actions, action diffs, and audit logging. | Operates identically in both modes. | **Live** |
| **GitHub Integration** | Connects to `api.github.com` when `GITHUB_TOKEN` is set. | Inspects local Git repository using native git commands and filesystem reads. | **Local Safe Mode** (detects local repo) |
| **Notion & Doc Sync** | Connects to Notion API when `NOTION_API_KEY` is set. | Synchronizes structured markdown files with frontmatter to `data/synced_docs/`. | **Local Safe Mode** (atomic disk sync) |
| **Email Dispatcher** | Connects to SMTP/SendGrid when credentials are set. | Stages in Approval Centre; logs approved dispatches to `data/outbox/`. | **Local Safe Mode** (approval gated) |
| **Scheduled Workflows Engine** | **100% Live.** Background ticker, interval execution, pause/resume, and execution history. | Operates identically in both modes. | **Live** |
| **LLM Inference** | Connects to Nebius Token Factory when `NEBIUS_API_KEY` is set. | Streams deterministic domain-aligned responses via `MastraLanguageModelV2Mock`. | **Mock Mode** (unless key set) |
