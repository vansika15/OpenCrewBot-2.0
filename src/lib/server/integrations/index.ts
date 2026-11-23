// Integration Manager for OpenCrewBot 2.0
// Unified exports for GitHub, Notion/Document Sync, and Email Dispatcher integrations.

export { gitHubIntegration, type GitHubRepoDetails } from "./github";
export { notionSync, type SyncDocResult } from "./notion";
export { emailDispatcher, type EmailPayload, type DispatchResult } from "./email";

export interface IntegrationSummary {
  id: string;
  name: string;
  description: string;
  category: "vcs" | "docs" | "communication";
  configured: boolean;
  mode: "LIVE" | "LOCAL_SAFE_MODE";
}

export function listAvailableIntegrations(): IntegrationSummary[] {
  return [
    {
      id: "github",
      name: "GitHub Integration",
      description: "Inspect repositories, track open issues, inspect file trees, and stage pull requests.",
      category: "vcs",
      configured: Boolean(process.env.GITHUB_TOKEN),
      mode: process.env.GITHUB_TOKEN ? "LIVE" : "LOCAL_SAFE_MODE",
    },
    {
      id: "notion",
      name: "Notion & Knowledge Base Sync",
      description: "Synchronize strategic research, meeting minutes, and competitor matrices to Notion pages.",
      category: "docs",
      configured: Boolean(process.env.NOTION_API_KEY),
      mode: process.env.NOTION_API_KEY ? "LIVE" : "LOCAL_SAFE_MODE",
    },
    {
      id: "email",
      name: "Email & Communication Dispatcher",
      description: "Draft, stage, and dispatch partnership emails with mandatory human approval gating.",
      category: "communication",
      configured: Boolean(process.env.SMTP_SERVER || process.env.SENDGRID_API_KEY),
      mode: process.env.SMTP_SERVER || process.env.SENDGRID_API_KEY ? "LIVE" : "LOCAL_SAFE_MODE",
    },
  ];
}
