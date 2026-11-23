# Offline and Mock Mode Guide — OpenCrewBot 2.0

OpenCrewBot 2.0 features a deterministic **Local Safe & Mock Mode** that guarantees complete system operability, testing, and UI exploration even when no external third-party API keys (Nebius, Tavily, GitHub, Notion, Browserbase) are configured.

---

## 1. How Mock Mode Works

When `NEBIUS_API_KEY` is not present in the environment:
1. The model layer falls back to the internal `MastraLanguageModelV2Mock` (`src/lib/server/mock-model.ts`).
2. The mock model is **not a random string generator**: it recognizes workforce tasks, user preference commands (`remember that...`), questions (`ask me...`), web research requests, and code execution.
3. For task DAG execution, the mock model recognizes the subtask context (e.g., `Competitive Landscape`, `Audience Persona`, `Content Calendar`, `Code Review`) and generates substantive, domain-aligned outputs tailored for MeetUniversity.
4. Fast mock execution (`FAST_MOCK=true`) streams tokens with 0ms delay, allowing automated CI test suites to complete all 7 business demonstrations in seconds.

---

## 2. Distinction: Mock Output vs. Live Output

- **Live Mode:** When `NEBIUS_API_KEY` is set, all agent turns are sent to Nebius Token Factory models (`MiniMax-M3`, `DeepSeek-V4-Pro`, etc.) and real live tokens are consumed and billed.
- **Mock Mode:** When running offline, all messages clearly display the italicized note:
  > *(Mock model. The tool really ran.)*
- **Integrations:**
  - GitHub Integration labels its output as `LOCAL_GIT_REPOSITORY` when running offline and reads the actual local git history and files.
  - Notion Doc Sync labels its output as `LOCAL_KNOWLEDGE_BASE` and writes atomic Markdown files to `data/synced_docs/`.
  - Email Dispatcher stages approval requests in the Approval Centre and logs dispatches to `data/outbox/`.

---

## 3. Running in Offline / Local Mode

No configuration is required! Simply start the application:

```bash
# Clone and enter directory
cd C:\Users\hp\Documents\EDXSO_Assignment_3\OpenCrewBot

# Start the application in local safe mode
pnpm dev
```
Open `http://127.0.0.1:3000` in your browser. All 8 agents, 4 collaboration rooms, skills, tasks, and approval centre will function out of the box.
