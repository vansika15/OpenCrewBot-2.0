import { body, handle } from "@/lib/server/http";
import { listAvailableIntegrations, gitHubIntegration, notionSync, emailDispatcher } from "@/lib/server/integrations";
import { InputError } from "@/lib/server/errors";

export async function GET() {
  return handle(async () => {
    const integrations = listAvailableIntegrations();
    return { integrations };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { action, integrationId, payload } = await body<{
      action: string;
      integrationId: string;
      payload?: Record<string, unknown>;
    }>(request);

    if (integrationId === "github") {
      if (action === "inspect") {
        const owner = (payload?.owner as string) || "Studio1-OSS";
        const repo = (payload?.repo as string) || "OpenCrewBot";
        const details = await gitHubIntegration.inspectRepository(owner, repo);
        return { result: details };
      }
      if (action === "read_file") {
        const filePath = (payload?.path as string) || "package.json";
        const content = await gitHubIntegration.readFileContent(filePath);
        return { result: { path: filePath, content } };
      }
      if (action === "create_pr_draft") {
        const title = (payload?.title as string) || "Engineering Improvement";
        const prBody = (payload?.body as string) || "Automated PR draft";
        const draft = await gitHubIntegration.createPullRequestDraft(title, prBody);
        return { result: draft };
      }
    }

    if (integrationId === "notion") {
      if (action === "sync_doc") {
        const title = (payload?.title as string) || "MeetUniversity Strategic Document";
        const content = (payload?.content as string) || "Document content";
        const tags = (payload?.tags as string[]) || ["Strategy"];
        const syncResult = await notionSync.syncDocument(title, content, tags);
        return { result: syncResult };
      }
    }

    if (integrationId === "email") {
      if (action === "dispatch" || action === "stage") {
        const to = (payload?.to as string) || "admissions@school.edu";
        const subject = (payload?.subject as string) || "Partnership Inquiry";
        const emailBody = (payload?.body as string) || "Email message body";
        const agentId = (payload?.agentId as string) || "atlas";
        const agentApproval = (payload?.agentApproval as "ask" | "controlled" | "full") || "ask";

        const result = await emailDispatcher.prepareAndDispatch({
          to,
          subject,
          body: emailBody,
          agentId,
          agentApproval,
          campaignContext: (payload?.campaign as string) || "Aspirations Outreach",
        });

        return { result };
      }
    }

    throw new InputError(`Unsupported action '${action}' for integration '${integrationId}'`);
  });
}
