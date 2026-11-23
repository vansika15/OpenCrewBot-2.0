# Multi-Tier Persistent Memory Architecture — OpenCrewBot 2.0

OpenCrewBot 2.0 implements a multi-tier persistent memory architecture stored directly in human-readable Markdown (`.md`) files on disk. Memory persists across application restarts and is directly editable by human operators.

---

## 1. Memory Tier Overview

```
                      ┌────────────────────────────────────────┐
                      │        Global Project Memory           │
                      │     (data/project/PROJECT_MEMORY.md)   │
                      │  Enterprise context, guidelines, facts │
                      └───────────────────┬────────────────────┘
                                          │
                     ┌────────────────────┴────────────────────┐
                     │                                         │
        ┌────────────▼──────────────┐             ┌────────────▼──────────────┐
        │    Shared Room Memory     │             │    Shared Room Memory     │
        │ data/rooms/r1/ROOM_MEMORY │             │ data/rooms/r2/ROOM_MEMORY │
        │ Active room objectives &  │             │ Active room objectives &  │
        │ shared research artifacts │             │ shared research artifacts │
        └────────────┬──────────────┘             └────────────┬──────────────┘
                     │                                         │
        ┌────────────┴──────────────┐             ┌────────────┴──────────────┐
        │   Individual Bot Memory   │             │   Individual Bot Memory   │
        │ data/workspaces/b1/MEMORY │             │ data/workspaces/b2/MEMORY │
        │ Agent heuristics, learned │             │ Agent heuristics, learned │
        │ user style & preferences  │             │ user style & preferences  │
        └───────────────────────────┘             └───────────────────────────┘
```

---

## 2. The Three Memory Tiers

### Tier 1: Global Project Memory (`data/project/PROJECT_MEMORY.md`)
- **Scope:** Accessible by all agents across all conversations and rooms.
- **Contents:**
  - Company Overview: MeetUniversity (Aspirations, Study Abroad, School Partnerships).
  - Global Operating Guidelines (analytical rigor, confirmation before write operations).
  - Historical strategic decisions.

### Tier 2: Shared Room Memory (`data/rooms/<roomId>/ROOM_MEMORY.md`)
- **Scope:** Shared among all members assigned to a specific collaboration room.
- **Contents:**
  - Active collaboration objectives.
  - Intermediate research findings shared by specialists.
  - Critique notes and consensus conclusions.

### Tier 3: Individual Agent Memory (`data/workspaces/<botId>/MEMORY.md`)
- **Scope:** Dedicated private scratchpad for an individual bot.
- **Contents:**
  - User interaction preferences (tone, format, style).
  - Domain-specific heuristics and personal notes.
  - Stored facts updated via `memory_add` and `memory_edit` tools.

---

## 3. Memory Provenance Tracking

Every durable memory item saved by agents or the Chief of Staff includes structured provenance metadata:
- **What:** The substantive fact, decision, or finding.
- **When:** ISO 8601 timestamp (`YYYY-MM-DDTHH:mm:ssZ`).
- **Why:** The contextual rationale for remembering this information.
- **Where:** Originating source (User conversation, Chief of Staff, Tool output).
- **Category:** `Preference`, `Decision`, `Finding`, or `Objective`.

### Provenance Markdown Format:
```markdown
- **[Preference]**: The user prefers brief bullet-pointed summaries with ROI numbers.
  - *When*: 2026-11-23T20:51:24.000Z
  - *Why*: User requested concise executive summaries in chat
  - *Source*: User Conversation in dm:atlas
```

---

## 4. Human Editing & Restart Adaptation (Demonstration 6)

1. **Human Editable:** Users can open any `.md` file in VS Code or via the Memory Manager modal (`/api/memory`).
2. **Exact Editing API (`PATCH /api/memory`):** Safely replaces target phrases with exact matching to avoid accidental deletions.
3. **Restart Persistence:** Memory files are stored on disk. When the server process restarts, the latest Markdown file is re-read on the first turn.
4. **Immediate Adaptation:** If a human edits a preference (e.g., from *"brief bullets"* to *"narrative prose"*), the agent immediately adopts the updated guidance in its very next turn.
