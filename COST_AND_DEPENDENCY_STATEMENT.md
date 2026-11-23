# Cost and Dependency Statement — OpenCrewBot 2.0

This document outlines the software dependencies, external services, API costs, and infrastructure requirements for OpenCrewBot 2.0.

---

## 1. Software Stack & Open Source Licenses

All core libraries used in OpenCrewBot 2.0 are permissively licensed:

| Dependency / Package | Version | License | Role in System |
| :--- | :--- | :--- | :--- |
| **Next.js** | `16.4.0` | MIT | Fullstack web framework (App Router, Turbopack, React 19) |
| **React / React-DOM** | `19.3.0` | MIT | Component architecture and UI rendering |
| **@mastra/core** | `1.76.0` | Apache-2.0 | Agent harness, session controller, tool abstraction |
| **@libsql/client** | `0.18.0` | MIT | Local SQLite database persistence (`opencrewbot.db`) |
| **@mastra/quickjs** | `0.1.3` | Apache-2.0 | Sandboxed WebAssembly TypeScript isolate |
| **@mastra/memory** | `1.37.0` | Apache-2.0 | Agent thread conversation memory storage |
| **Tailwind CSS** | `4.3.3` | MIT | Utility-first UI styling |
| **Lucide React** | `1.55.0` | ISC | Modern iconography |
| **Zod** | `4.6.7` | MIT | Runtime schema validation |
| **TSX** | `4.23.15` | MIT | Direct TypeScript runtime for test execution |

---

## 2. LLM Model Pricing & Operational Costs

OpenCrewBot 2.0 supports multi-model intelligence. Below are the standard operational pricing tiers:

| Model ID | Provider | Input Cost (per 1M tokens) | Output Cost (per 1M tokens) | Recommended Role |
| :--- | :--- | :--- | :--- | :--- |
| **MiniMaxAI/MiniMax-M3** | Nebius | \$0.30 | \$1.20 | General agent conversational turns & writing |
| **deepseek-ai/DeepSeek-V4-Flash** | Nebius | \$0.14 | \$0.28 | Fast classification, simple data extraction |
| **deepseek-ai/DeepSeek-V4-Pro** | Nebius | \$1.75 | \$3.50 | Complex planning, Chief of Staff orchestration |
| **moonshotai/Kimi-K2.7-Code** | Nebius | \$0.95 | \$4.00 | Software architecture, Code review |
| **Local Deterministic Mock** | Internal | **\$0.00** | **\$0.00** | Offline development, testing, and CI evaluation |

### Estimated Demonstration Costs
- Running the complete 7 MeetUniversity business demonstrations using live Nebius models costs approximately **\$0.04 – \$0.08** total across ~60,000 input tokens and ~15,000 output tokens.
- Running on the built-in Deterministic Mock costs **\$0.00**.

---

## 3. External API Dependencies (Optional)

The application is completely self-contained and operates locally out-of-the-box without requiring paid API keys:
- **Nebius Token Factory (`NEBIUS_API_KEY`):** Optional. When omitted, the local deterministic mock model handles turns.
- **Tavily (`TAVILY_API_KEY`):** Optional. Used for live web search; when omitted, agents use cached research or internal knowledge.
- **GitHub (`GITHUB_TOKEN`):** Optional. When omitted, GitHub integration inspects the local Git repository directly.
- **Notion (`NOTION_API_KEY`):** Optional. When omitted, doc sync saves to local structured Markdown in `data/synced_docs/`.
- **Browserbase (`BROWSERBASE_API_KEY`):** Optional. Used for cloud Playwright browser sessions.
