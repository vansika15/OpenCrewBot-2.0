// Dynamic Agent Creation Factory for OpenCrewBot 2.0
// Allows users to create complete, configured agents through natural language instructions.

import type { AgentFactoryInput, AgentFactoryResult, Bot, BotInput } from "@/lib/shared/types";
import { createBot } from "../service";
import { DEFAULT_MODEL } from "../models";

interface SynthesizedProfile {
  name: string;
  title: string;
  description: string;
  instructions: string;
  emoji: string;
  color: string;
  model: string;
  tools: {
    webSearch: boolean;
    memory: boolean;
    codeMode: boolean;
    browser: boolean;
    askUser: boolean;
  };
  approval: "ask" | "controlled" | "full";
  suggestedSkills: string[];
  reasoning: string;
}

export class AgentFactory {
  /**
   * Synthesizes an agent specification from a natural language prompt.
   * If external LLM is configured, it can enhance generation; otherwise, uses intelligent semantic heuristics.
   */
  synthesizeProfile(prompt: string, preferredModel?: string, permissionLevel?: "ask" | "controlled" | "full"): SynthesizedProfile {
    const text = prompt.toLowerCase();

    // Determine domain and role archetype
    let name = "Agent";
    let title = "Specialist";
    let emoji = "🤖";
    let color = "#3b82f6";
    let description = "Specialized AI worker created via Agent Factory.";
    let instructions = "";
    const tools = { webSearch: true, memory: true, codeMode: false, browser: false, askUser: true };
    const suggestedSkills: string[] = [];

    if (text.includes("market") || text.includes("competitor") || text.includes("intelligence")) {
      name = "Radar";
      title = "Market Intelligence Lead";
      emoji = "🔭";
      color = "#0ea5e9";
      description = "Analyzes competitive landscapes, product pricing, positioning, and strategic market gaps.";
      instructions =
        "You are an expert Market Intelligence Lead. Conduct deep competitive analysis, price benchmarking, and customer segment profiling. Provide structured comparison tables and cite your sources.";
      tools.webSearch = true;
      tools.codeMode = true;
      suggestedSkills.push("Market Research", "Competitor Analysis");
    } else if (text.includes("finance") || text.includes("financial") || text.includes("model") || text.includes("revenue") || text.includes("cost")) {
      name = "Ledger";
      title = "Financial Modelling Expert";
      emoji = "📊";
      color = "#10b981";
      description = "Builds unit economics models, CAC/LTV projections, and financial impact analyses.";
      instructions =
        "You are a Senior Financial Modeling Specialist. Provide precise, formulaic breakdowns of revenue streams, unit economics, conversion metrics, and pricing tiers. Avoid hand-wavy estimates; verify calculations.";
      tools.codeMode = true;
      suggestedSkills.push("Financial Modelling", "Data Analysis");
    } else if (text.includes("marketing") || text.includes("campaign") || text.includes("content") || text.includes("social") || text.includes("copy")) {
      name = "Cadence";
      title = "Growth & Campaign Strategist";
      emoji = "🚀";
      color = "#f59e0b";
      description = "Develops go-to-market strategies, campaign roadmaps, and high-converting marketing collateral.";
      instructions =
        "You are a Senior Growth & Campaign Strategist. Craft audience-targeted campaign concepts, 30-day content calendars, and compelling messaging tailored to student or partner demographics.";
      tools.webSearch = true;
      suggestedSkills.push("Email Drafting", "Presentation Creation");
    } else if (text.includes("code") || text.includes("dev") || text.includes("software") || text.includes("engineer") || text.includes("github")) {
      name = "Forge";
      title = "Principal Software Architect";
      emoji = "⚡";
      color = "#8b5cf6";
      description = "Inspects codebases, identifies security vulnerabilities, and plans technical roadmaps.";
      instructions =
        "You are a Principal Software Architect. Review code for reliability, maintainability, and security. Recommend prioritized technical improvements with clean file diffs. Seek approval before destructive changes.";
      tools.codeMode = true;
      suggestedSkills.push("Code Review");
    } else if (text.includes("sales") || text.includes("lead") || text.includes("partnership") || text.includes("outreach")) {
      name = "Nexus";
      title = "Partnerships & Lead Specialist";
      emoji = "🤝";
      color = "#ec4899";
      description = "Targets ideal customer profiles, drives school/university partnerships, and drafts outreach.";
      instructions =
        "You are an Enterprise Partnerships Specialist. Identify key institutional decision-makers, craft personalized outreach, and propose win-win collaboration frameworks.";
      tools.webSearch = true;
      suggestedSkills.push("Lead Generation", "Email Drafting");
    } else if (text.includes("data") || text.includes("analytics") || text.includes("spreadsheet") || text.includes("metrics")) {
      name = "Metric";
      title = "Senior Data Analyst";
      emoji = "📈";
      color = "#6366f1";
      description = "Extracts insights, conversion funnels, and statistical trends from raw business datasets.";
      instructions =
        "You are a Senior Data Analyst. Process tabular datasets, calculate drop-off bottlenecks, compute segment performance, and present findings in clean markdown tables with actionable takeaways.";
      tools.codeMode = true;
      suggestedSkills.push("Data Analysis", "Financial Modelling");
    } else {
      // General agent synthesis
      const words = prompt.trim().split(/\s+/);
      const mainWord = words[0] ? words[0].charAt(0).toUpperCase() + words[0].slice(1) : "Omni";
      name = mainWord;
      title = "Autonomous Workforce Specialist";
      emoji = "✨";
      color = "#64748b";
      description = `Autonomous agent tailored for: ${prompt.slice(0, 100)}`;
      instructions = `You are ${name}, a dedicated specialist. Your core mission is: "${prompt}". Execute instructions with high rigor, verify facts, and format answers cleanly.`;
      suggestedSkills.push("Market Research", "Data Analysis");
    }

    // Append custom prompt context to instructions
    instructions += `\n\nUser Design Directive: "${prompt.trim()}".`;

    return {
      name,
      title,
      description,
      instructions,
      emoji,
      color,
      model: preferredModel || DEFAULT_MODEL,
      tools,
      approval: permissionLevel || "ask",
      suggestedSkills,
      reasoning: `Synthesized specialized persona '${name}' (${title}) equipped with appropriate analytical tools and permission levels matching the requested directive.`,
    };
  }

  /**
   * Creates an agent dynamically from natural language and saves it to the database.
   * Immediately available in the workspace without changing application code.
   */
  async createAgentFromPrompt(input: AgentFactoryInput): Promise<AgentFactoryResult> {
    const profile = this.synthesizeProfile(input.prompt, input.preferredModel, input.permissionLevel);

    const botInput: BotInput = {
      name: profile.name,
      title: profile.title,
      description: profile.description,
      instructions: profile.instructions,
      emoji: profile.emoji,
      color: profile.color,
      model: profile.model,
      tools: profile.tools,
      approval: profile.approval,
      pinned: false,
    };

    const bot = await createBot(botInput);

    return {
      bot,
      suggestedSkills: profile.suggestedSkills,
      reasoning: profile.reasoning,
    };
  }
}

export const agentFactory = new AgentFactory();
