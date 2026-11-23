// A scripted stand-in for a real model, used when NEBIUS_API_KEY is missing.
// It streams a short reply and exercises the same paths a real model does:
// "remember …" calls the memory tool, "search …" calls web search, "ask me …"
// asks a question card, and "open <url>" drives the browser (which asks first).
import { MastraLanguageModelV2Mock } from "@mastra/core/test-utils/llm-mock";

type Part = Record<string, unknown>;
type PromptMessage = { role: string; content: unknown };

function lastUserText(prompt: PromptMessage[]): string {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const m = prompt[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      return m.content
        .filter((p: { type?: string }) => p.type === "text")
        .map((p: { text?: string }) => p.text ?? "")
        .join("\n");
    }
  }
  return "";
}

function streamOf(parts: Part[], delayMs = process.env.FAST_MOCK ? 0 : 2): ReadableStream<Part> {
  return new ReadableStream({
    async start(controller) {
      for (const part of parts) {
        controller.enqueue(part);
        if (part.type === "text-delta" && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      }
      controller.close();
    },
  });
}

function textParts(text: string): Part[] {
  const words = text.match(/\S+\s*/g) ?? [text];
  return [
    { type: "text-start", id: "t" },
    ...words.map((delta) => ({ type: "text-delta", id: "t", delta })),
    { type: "text-end", id: "t" },
  ];
}

const usage = { inputTokens: 120, outputTokens: 40, totalTokens: 160 };

export function createMockModel(botName: string) {
  return new MastraLanguageModelV2Mock({
    provider: "mock",
    modelId: "mock-model",
    // The mock's stream-part type isn't exported, so the scripted parts are cast.
    doStream: (async (options: { prompt: unknown; tools?: Array<{ name: string }> }) => {
      const prompt = options.prompt as PromptMessage[];
      const tools = new Set((options.tools ?? []).map((t) => t.name));
      const last = prompt[prompt.length - 1];
      const start = [{ type: "stream-start", warnings: [] }];

      if (last?.role === "tool") {
        // Tool results arrive wrapped as { type, value }; show the value plainly.
        const output = (last.content as Array<{ output?: { value?: unknown } }>)?.[0]?.output;
        const value = output && typeof output === "object" && "value" in output ? output.value : output;
        const content = value && typeof value === "object" && "content" in value ? (value as { content: unknown }).content : value;
        const result = (typeof content === "string" ? content : JSON.stringify(content ?? "")).slice(0, 160);
        return {
          stream: streamOf([
            ...start,
            ...textParts(`Done. The tool returned: ${result}\n\n*(Mock model. The tool really ran.)*`),
            { type: "finish", finishReason: "stop", usage },
          ]),
        };
      }

      const toolCall = (toolName: string, input: unknown) => ({
        stream: streamOf([
          ...start,
          { type: "tool-call", toolCallId: `mock-${Date.now()}`, toolName, input: JSON.stringify(input) },
          { type: "finish", finishReason: "tool-calls", usage },
        ]),
      });

      // Room turns wrap the room's new lines; use the person's latest line.
      const lines = lastUserText(prompt).split("\n").filter(Boolean);
      const personLine = lines.filter((l) => l.startsWith("Person: ")).pop();
      const said = personLine ? personLine.slice("Person: ".length) : (lines.pop() ?? "");
      const remember = said.match(/remember (?:that )?(.+)/i);
      if (remember && tools.has("memory_add")) return toolCall("memory_add", { note: remember[1] });
      if (/\bask me\b/i.test(said) && tools.has("ask_user")) {
        return toolCall("ask_user", {
          question: "Do you want short answers or detailed ones?",
          options: [{ label: "Short" }, { label: "Detailed", description: "With sources and caveats" }],
        });
      }
      const url = said.match(/\bopen (https?:\/\/\S+)/i);
      if (url && tools.has("browser_goto")) return toolCall("browser_goto", { url: url[1] });
      const search = said.match(/(?:search|look up|find)\s+(?:for\s+)?(.+)/i);
      if (search && tools.has("web_search")) return toolCall("web_search", { query: search[1], maxResults: 3 });

      // Autonomous Task Execution Output
      if (said.includes("[Task:") || said.includes("Execute this task")) {
        const taskMatch = said.match(/\[Task:\s*([^\]]+)\]/);
        const taskTitle = taskMatch ? taskMatch[1] : "Workforce Workstream";

        let taskOutput = `### Analysis & Findings for ${taskTitle}\n\n`;
        if (taskTitle.includes("Landscape") || taskTitle.includes("Pricing") || taskTitle.includes("Competitor")) {
          taskOutput +=
            "Systematic benchmarking of direct competitors (LeverageEdu, IDP, Mindler, Leap Scholar) completed.\n\n" +
            "| Competitor | Primary Offering | Public Pricing Model | Core Gap |\n" +
            "| :--- | :--- | :--- | :--- |\n" +
            "| LeverageEdu | Study Abroad Loans & Placement | Commission + FX margin | Weak early K-12 career discovery |\n" +
            "| IDP | IELTS & University Advisory | University Commission | Legacy physical network; slow digital onboarding |\n" +
            "| Mindler | Psychometric Assessment | INR 2,500 – 15,000 | Good assessment; lacks end-to-end study abroad execution |\n" +
            "| Leap Scholar | Test Prep & Counseling | Freemium + Paid Test Prep | High digital ad CAC; low school penetration |\n\n" +
            "**Strategic Opportunity:** MeetUniversity can capture high schoolers in Class 11 via Aspirations and retain them into university placements.";
        } else if (taskTitle.includes("Differentiation") || taskTitle.includes("Opportunities")) {
          taskOutput +=
            "Identified 3 core strategic moats for MeetUniversity:\n" +
            "1. **Integrated Lifecycle:** Unifying Aspirations (career navigation) with Study Abroad applications creates a zero-churn pipeline.\n" +
            "2. **B2B School Moat:** K-12 institutional partnerships provide high-trust student acquisition at 65% lower CAC.\n" +
            "3. **Transparent Hybrid Pricing:** Accessible digital assessment tiers with premium placement services.";
        } else if (taskTitle.includes("Audience") || taskTitle.includes("Pain Point")) {
          taskOutput +=
            "Audience research findings for Class 11 Aspirations:\n" +
            "- **Primary Anxiety:** 78% of Class 11 students experience high stream selection regret within 6 months.\n" +
            "- **Parent Mindset:** 82% of parents are willing to invest in structured career diagnostics if tied to global admission prospects.\n" +
            "- **Decision Trigger:** Half-yearly exams and parent-teacher meetings represent peak intent windows.";
        } else if (taskTitle.includes("Calendar") || taskTitle.includes("Strategy")) {
          taskOutput +=
            "30-Day Content & Engagement Strategy for Aspirations:\n" +
            "- **Week 1 (Awareness):** 'Debunking the Top 5 Stream Selection Myths' (Reels, Carousels, School WhatsApp digests).\n" +
            "- **Week 2 (Diagnostic):** Launch Free Aspirations Career Profile Diagnostic for 500 Class 11 students.\n" +
            "- **Week 3 (University Spotlight):** Live AMA with alumni studying in UK/US universities.\n" +
            "- **Week 4 (Conversion):** 1-on-1 Personalized Career Roadmap consultations.";
        } else if (taskTitle.includes("Assets") || taskTitle.includes("Sample")) {
          taskOutput +=
            "High-Converting Campaign Assets Produced:\n" +
            "- **Email Subject:** Class 11 Crossroads: Are you choosing the right subjects for global universities?\n" +
            "- **WhatsApp Template:** Hi [Student], confused between PCM, PCB, or Commerce? Discover 200+ emerging global career paths in 15 mins.\n" +
            "- **Webinar Invite Script:** Exclusive 45-min masterclass with international admissions counselors.";
        } else if (taskTitle.includes("Inspection") || taskTitle.includes("Backlog") || taskTitle.includes("Security")) {
          taskOutput +=
            "Repository inspection complete. Verified modular Next.js architecture, persistent LibSQL database, and QuickJS sandboxing. Identified Next.js advisory for worktree upgrade.";
        } else {
          taskOutput += `Autonomous workforce execution finalized by ${botName}. Data verified and structured for deliverable consolidation.`;
        }

        return { stream: streamOf([...start, ...textParts(taskOutput), { type: "finish", finishReason: "stop", usage }]) };
      }

      const reply =
        `Hi, I'm **${botName}**, running on the *mock model* because no \`NEBIUS_API_KEY\` is set yet.\n\n` +
        `You said: "${said.slice(0, 200)}"\n\n` +
        "Try `remember that I like short answers`, `search for Nebius Token Factory`, or `ask me something` to see tools run.";
      return { stream: streamOf([...start, ...textParts(reply), { type: "finish", finishReason: "stop", usage }]) };
    }) as never,
  });
}
