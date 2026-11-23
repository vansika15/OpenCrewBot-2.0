# Known Limitations — OpenCrewBot 2.0

While OpenCrewBot 2.0 fulfills all 10 required modules and the 7 MeetUniversity business scenarios, the following architectural and environment boundaries are noted for full transparency.

---

## 1. Environment & Architecture Boundaries

1. **Single-Node Execution:** The task execution engine and interval scheduler currently run in-process on the local Node.js server. For a multi-node cluster deployment, task queues should be backed by Redis / BullMQ or Celery.
2. **Next.js 16 Security Advisory:** The Next.js Turbopack build flags an advisory on version `16.4.0`. The command line provides a guided upgrade path (`next upgrade --agent=security`). Upgrading in a separate branch is recommended before production enterprise rollout.
3. **Local Database Concurrency:** SQLite via LibSQL client is optimized for single-host operations. For enterprise workloads exceeding 1,000 concurrent agents, migration to PostgreSQL or distributed LibSQL Turso is recommended.
4. **Browser Automation:** Browserbase CDP requires a paid API key for remote cloud Playwright streaming. In local offline mode, the live view iframe displays a gentle "Browser is asleep" placeholder until a key is configured.

---

## 2. Planned Future Enhancements

- Multi-tenant team authentication (OAuth2 / SAML SSO).
- Webhook triggers for incoming integrations (e.g., Slack event subscriptions).
- Distributed vector database integration (pgvector / Qdrant) alongside the current Markdown memory architecture for semantic search across millions of memory items.
