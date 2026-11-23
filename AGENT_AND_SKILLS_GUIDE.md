# Agent and Skills Guide — OpenCrewBot 2.0

This guide documents the pre-configured workforce agents, dynamic agent creation procedures, and the 8 reusable modular skills.

---

## 1. Workforce Roster (Pre-Configured Agents)

| Agent Name | Handle | Title & Emoji | Primary Role & Archetype | Tools & Skills Configured | Default Permission |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Atlas** | `@atlas` | Chief of Staff & Planning 🧭 | Autonomous task decomposition, workforce delegation, deliverable consolidation | Web Search, Memory, Code Mode, Ask User | `ask` |
| **Scout** | `@scout` | Research & Intelligence 🔭 | Fact retrieval, web scraping, secondary source auditing, citations | Web Search, Memory, Code Mode, Ask User | `ask` |
| **Quill** | `@quill` | Writing & Content ✒️ | Executive reporting, copy drafting, narrative synthesis, campaigns | Memory, Code Mode, Ask User | `ask` |
| **Radar** | `@radar` | Competitive Intelligence 🎯 | Competitor benchmarking, pricing teardowns, positioning gap analysis | Web Search, Memory, Code Mode | `ask` |
| **Ledger** | `@ledger` | Financial Modelling 📊 | Unit economics, CAC/LTV modeling, revenue sensitivity projections | Memory, Code Mode | `ask` |
| **Cadence** | `@cadence` | Growth & Campaigns 🚀 | 30-day content calendars, student acquisition funnels, outbound campaigns | Web Search, Memory, Code Mode | `ask` |
| **Metric** | `@metric` | Senior Data Analyst 📈 | Tabular data calculations, funnel drop-off analysis, conversion bottlenecks | Memory, Code Mode | `ask` |
| **Forge** | `@forge` | Principal Software Architect ⚡ | Codebase inspection, dependency audits, pull request staging | Memory, Code Mode | `ask` |

---

## 2. Dynamic Agent Creation via Natural Language

Users can spawn new agents dynamically without modifying application code via the **Dynamic Agent Factory** modal or `POST /api/agent-factory`.

### Example Natural-Language Directive:
> *"Create a University Admissions Counselor specializing in UK and Canadian STEM undergraduate applications."*

### System Synthesized Configuration:
- **Name:** Horizon
- **Title:** Global Admissions Specialist
- **Emoji:** 🎓 | **Color:** `#0284c7`
- **Persona:** Specialized in UCAS deadlines, Canadian prerequisite courses, and scholarship criteria.
- **Tools:** `webSearch: true`, `memory: true`, `codeMode: false`, `browser: false`, `askUser: true`
- **Memory Initialized:** `data/workspaces/<botId>/MEMORY.md`
- **Availability:** Instantly ready in room chats and task execution DAGs.

---

## 3. Reusable Skills Ecosystem

All 8 skills are registered in `src/lib/server/skills/registry.ts` and can be invoked programmatically via `/api/skills` or autonomously by agents during task execution.

### 1. Market Research (`market-research`)
- **Category:** `research`
- **Purpose:** Industry macro trends, demographic analysis, and TAM/SAM/SOM market sizing.
- **Example Output:** TAM of \$3.2B across Indian secondary education; SAM of \$850M in private urban K-12 schools.

### 2. Competitor Analysis (`competitor-analysis`)
- **Category:** `research`
- **Purpose:** Competitor feature matrix, public pricing models, and positioning gap analysis.
- **Benchmarks:** LeverageEdu, IDP Education, Mindler, Leap Scholar.

### 3. Financial Modelling (`financial-modelling`)
- **Category:** `finance`
- **Purpose:** Unit economics, CAC/LTV calculations, payback period, and gross margin sensitivity.
- **Formula Logic:** $\text{Gross Profit} = \text{Students} \times \text{Price} \times \text{Margin}\%$; $\text{LTV/CAC} = \frac{\text{Price} \times \text{Margin}\%}{\text{CAC}}$.

### 4. Presentation Creation (`presentation-creation`)
- **Category:** `communication`
- **Purpose:** Structured 6–10 slide executive decks with visual layout blueprints and talking points.

### 5. Email Drafting (`email-drafting`)
- **Category:** `communication`
- **Purpose:** High-converting cold outreach, school partnership proposals, and webinar invitation scripts.

### 6. Code Review (`code-review`)
- **Category:** `engineering`
- **Purpose:** Codebase security audits, architectural inspections, and prioritized technical improvement roadmaps.

### 7. Data Analysis (`data-analysis`)
- **Category:** `analysis`
- **Purpose:** Tabular sales pipeline calculations, conversion drop-off identification, and bottleneck diagnosis.
- **MeetUniversity Pipeline:** Analyzes 12,500 sample inquiries, identifies the 56.9% diagnostic drop-off, and models +INR 42.5 Lakhs revenue upside.

### 8. Lead Generation (`lead-generation`)
- **Category:** `marketing`
- **Purpose:** Ideal Customer Profile (ICP) qualification, account scoring, and qualified outbound pipeline generation.
