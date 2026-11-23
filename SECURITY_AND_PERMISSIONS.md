# Security and Permissions Architecture — OpenCrewBot 2.0

OpenCrewBot 2.0 implements a strict **3-Tier Autonomy and Security Model** with a centralized **Approval Centre**, action diff previews, and immutable audit logging.

---

## 1. The 3 Permission Levels

```
                     ┌─────────────────────────────────────────┐
                     │          3-Tier Autonomy Model          │
                     └────────────────────┬────────────────────┘
                                          │
         ┌────────────────────────────────┼────────────────────────────────┐
         │                                │                                │
┌────────▼────────┐              ┌────────▼────────┐              ┌────────▼────────┐
│  1. Ask First   │              │  2. Controlled  │              │ 3. Full Access  │
│  (ask / ask_1)  │              │  (controlled)   │              │  (full_access)  │
├─────────────────┤              ├─────────────────┤              ├─────────────────┤
│ ALL external &  │              │ Safe reads run  │              │ Autonomous      │
│ sensitive writes│              │ autonomously;   │              │ execution across│
│ require human   │              │ writes require  │              │ permitted scopes│
│ confirmation.   │              │ confirmation.   │              │                 │
└─────────────────┘              └─────────────────┘              └─────────────────┘
```

### Tier 1: Ask First (`ask` / `ask_first`)
- **Policy:** The agent cannot execute any external API write, code modification, or outbound communication without explicit human confirmation.
- **Use Case:** Junior or newly created agents; high-risk operations (emailing real partner schools, applying code patches).

### Tier 2: Controlled Access (`controlled`)
- **Policy:** Pre-approved read operations, local analytics, and data transformations execute autonomously within defined boundaries. Any operation that modifies state or contacts external systems triggers human approval.
- **Use Case:** Routine business intelligence and data processing agents.

### Tier 3: Full Access (`full` / `full_access`)
- **Policy:** Autonomous execution within the agent's permitted tool scopes.
- **Use Case:** Background scheduled routines and verified autonomous agents.

---

## 2. Centralized Approval Centre (`/api/approvals`)

The Approval Centre serves as the operational cockpit for human supervisors.

### Key Capabilities:
1. **Pending Queue:** Lists all actions staged by agents awaiting human approval across the workforce.
2. **Action Diff Previews:** Displays exact email text, recipients, or code diffs before execution.
3. **Approve / Reject Controls:** One-click confirmation or rejection with an optional reason note.
4. **Strict Rejection Enforcement:** When an action is rejected:
   - The pending state transitions to `REJECTED`.
   - The associated subtask fails with a clear message: *"Action strictly rejected by human supervisor"*.
   - **The action payload is purged and NEVER executed.**
   - Verified in Demonstration 7: Rejected emails are not dispatched, and no files are written to outbox.

---

## 3. Immutable Audit Logging (`/api/audit-logs`)

Every security decision, task execution, tool approval, and human intervention is recorded in SQLite in the `audit_logs` table.

### Audit Log Schema:
- **`id`:** Unique UUID.
- **`timestamp`:** ISO 8601 timestamp.
- **`actor`:** Agent ID, User ID, or `human_supervisor`.
- **`action`:** `approval_requested`, `approval_granted`, `approval_rejected`, `task_executed`, `workflow_executed`.
- **`resource`:** ID of the task, approval request, or workflow.
- **`details`:** Descriptive summary of the operation.
- **`permissionLevel`:** The active permission tier of the agent.
- **`approved`:** Boolean flag (`true` / `false`).
- **`reason`:** Rejection justification or approval note.
