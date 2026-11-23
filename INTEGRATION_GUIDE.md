# Integrations Guide — OpenCrewBot 2.0

OpenCrewBot 2.0 provides three native, production-grade integrations that operate in dual modes: **Live API Mode** (when external API credentials are provided) and **Local Safe Mode** (when running locally or offline without external API keys).

---

## 1. Supported Integrations Overview

| Integration | Primary Purpose | Live Mode Trigger | Local Safe Mode Behavior |
| :--- | :--- | :--- | :--- |
| **GitHub Integration** | Inspect repositories, audit code, stage PRs | `GITHUB_TOKEN` set | Inspects local Git repository (`OpenCrewBot`) using native git commands; reads real local files. |
| **Notion & Doc Sync** | Synchronize strategic reports & documentation | `NOTION_API_KEY` set | Synchronizes structured Markdown files to `data/synced_docs/` with metadata headers. |
| **Email Dispatcher** | Draft, preview, and dispatch partnership emails | `SMTP_SERVER` or SendGrid/Resend key set | Stages emails in `ApprovalCenter` when approval is required; writes dispatched records to `data/outbox/`. |

---

## 2. GitHub Integration (`src/lib/server/integrations/github.ts`)

### Configuration
```bash
# Optional for live GitHub API access:
export GITHUB_TOKEN="ghp_yourPersonalAccessTokenHere"
```

### Capabilities
- **Repository Inspection:** Queries repository metadata, open issues count, default branch, recent commits, and key files.
- **File Content Reader:** Reads raw source files directly from the repository.
- **Pull Request Staging:** Prepares structured pull request proposals with technical justification and diff previews.

### API Endpoint: `POST /api/integrations`
```json
{
  "integrationId": "github",
  "action": "inspect",
  "payload": { "owner": "Studio1-OSS", "repo": "OpenCrewBot" }
}
```

---

## 3. Notion & Knowledge Base Sync (`src/lib/server/integrations/notion.ts`)

### Configuration
```bash
# Optional for live Notion API access:
export NOTION_API_KEY="secret_yourNotionIntegrationToken"
```

### Capabilities
- Synchronizes executive deliverables, competitor analyses, and meeting minutes to Notion databases or local atomic markdown documentation files.
- Each document includes frontmatter with title, timestamp, tags, and origin.

### API Endpoint: `POST /api/integrations`
```json
{
  "integrationId": "notion",
  "action": "sync_doc",
  "payload": {
    "title": "MeetUniversity Competitor Intelligence Report",
    "content": "# Market Analysis...",
    "tags": ["Market Intelligence", "Competitors"]
  }
}
```

---

## 4. Email & Communication Dispatcher (`src/lib/server/integrations/email.ts`)

### Configuration
```bash
# Optional for live SMTP dispatch:
export SMTP_SERVER="smtp.provider.com"
export SMTP_USER="user@domain.com"
export SMTP_PASS="secret"
```

### Safety & Approval Gate
- If the sending agent is configured with `approval: "ask"` or `approval: "controlled"`, the email is **NOT** dispatched directly.
- An action preview is generated and staged in the **Approval Centre** (`/api/approvals`).
- Only when human approval is granted will the email be dispatched.
- If rejected by the human supervisor, the action is immediately terminated, and no email is sent.
