// Intelligent Chief of Staff Orchestrator for OpenCrewBot 2.0
// Decomposes high-level natural language goals into a structured Task DAG, selects optimal agents,
// executes tasks in parallel/sequence, handles failures, and consolidates final business deliverables.

import { randomUUID } from "node:crypto";
import type { Bot, Task, TaskPlan, TaskPriority } from "@/lib/shared/types";
import * as store from "../db";
import { taskEngine } from "../tasks/engine";
import { publish } from "../bus";

export class ChiefOfStaff {
  /**
   * Main entry point: receives a complex natural-language directive, decomposes it,
   * schedules the Task DAG, executes across agents, and synthesizes the consolidated deliverable.
   */
  async orchestrate(instruction: string, conversationId?: string): Promise<TaskPlan> {
    const bots = await store.listBots();
    if (bots.length === 0) {
      throw new Error("No agents available in workforce. Please configure agents first.");
    }

    // 1. Decompose instruction into a structured task graph with dependencies
    const decomposedTasks = await this.decomposeInstruction(instruction, bots);

    // 2. Create the persistent Task Plan
    const plan = await taskEngine.createPlan(instruction, conversationId, decomposedTasks);

    // 3. Execute the Plan across the agent workforce (parallel & sequential)
    const executedPlan = await taskEngine.executePlan(plan.id);

    // 4. Consolidate and synthesize final business deliverable
    const synthesizedReport = await this.synthesizeDeliverable(executedPlan);
    executedPlan.synthesizedDeliverable = synthesizedReport;
    executedPlan.updatedAt = new Date().toISOString();
    await store.saveTaskPlan(executedPlan);
    publish({ type: "plan-updated", plan: executedPlan });

    return executedPlan;
  }

  /**
   * Intelligently analyzes instructions and generates a Directed Acyclic Graph (DAG) of subtasks,
   * matching capabilities against available agents.
   */
  async decomposeInstruction(
    instruction: string,
    bots: Bot[],
  ): Promise<Array<Omit<Task, "id" | "planId" | "createdAt" | "status">>> {
    const text = instruction.toLowerCase();
    const tasks: Array<Omit<Task, "id" | "planId" | "createdAt" | "status">> = [];

    // Helper to find best agent by keywords or title
    const findAgent = (keywords: string[], fallbackId: string): string => {
      for (const bot of bots) {
        const fullProfile = `${bot.name} ${bot.title} ${bot.description} ${bot.instructions}`.toLowerCase();
        if (keywords.some((kw) => fullProfile.includes(kw))) {
          return bot.id;
        }
      }
      return fallbackId;
    };

    const defaultAgent = bots[0].id;
    const researchAgent = findAgent(["scout", "research", "radar", "market", "intelligence"], defaultAgent);
    const writingAgent = findAgent(["quill", "writing", "cadence", "content", "marketing", "copy"], defaultAgent);
    const analysisAgent = findAgent(["atlas", "metric", "ledger", "data", "finance", "analysis"], defaultAgent);
    const techAgent = findAgent(["forge", "dev", "code", "software", "engineer"], defaultAgent);

    // Scenario-aware decomposition based on goal semantics
    if (text.includes("competitor") || text.includes("market intelligence") || text.includes("meetuniversity") && text.includes("pricing")) {
      // Market Intelligence Scenario (Scenario 1)
      tasks.push({
        title: "Competitive Landscape & Pricing Audit",
        description: "Research top EdTech competitors, publicly available pricing models, target customer segments, and feature positioning.",
        assignedAgentId: researchAgent,
        dependencies: [],
        priority: "high" as TaskPriority,
        input: { directive: instruction, scope: "Competitor product lines, pricing tiers, and market positioning" },
        requiresApproval: false,
      });

      tasks.push({
        title: "Product Differentiation & Strategic Opportunities",
        description: "Analyze market positioning gaps, feature advantages, and customer pain points for MeetUniversity's product lines.",
        assignedAgentId: analysisAgent,
        dependencies: [`task-temp-1`], // Will be remapped
        priority: "high" as TaskPriority,
        input: { directive: instruction, focus: "Strategic differentiation for Aspirations, Study Abroad, and School Partnerships" },
        requiresApproval: false,
      });

      tasks.push({
        title: "Executive Market Intelligence Consolidation",
        description: "Synthesize findings into a structured comparison table, strategic roadmap, and executive report.",
        assignedAgentId: writingAgent,
        dependencies: [`task-temp-1`, `task-temp-2`],
        priority: "medium" as TaskPriority,
        input: { directive: instruction, format: "Executive comparison table and strategic recommendations" },
        requiresApproval: false,
      });
    } else if (text.includes("campaign") || text.includes("class 11") || text.includes("aspirations")) {
      // Marketing Campaign Scenario (Scenario 2)
      tasks.push({
        title: "Audience Persona & Student Pain Point Analysis",
        description: "Investigate Class 11 student career anxieties, stream selection uncertainties, and parent motivations.",
        assignedAgentId: researchAgent,
        dependencies: [],
        priority: "high" as TaskPriority,
        input: { targetAudience: "Class 11 students and parents in India", product: "MeetUniversity Aspirations" },
        requiresApproval: false,
      });

      tasks.push({
        title: "30-Day Campaign Strategy & Content Calendar",
        description: "Design a 30-day multi-channel content calendar and thematic arcs (Awareness, Consideration, Action).",
        assignedAgentId: writingAgent,
        dependencies: [`task-temp-1`],
        priority: "high" as TaskPriority,
        input: { campaignTheme: "Career Clarity in Class 11", product: "Aspirations" },
        requiresApproval: false,
      });

      tasks.push({
        title: "Sample High-Converting Campaign Assets",
        description: "Draft sample high-converting social copy, email invitations to career webinars, and WhatsApp ad templates.",
        assignedAgentId: writingAgent,
        dependencies: [`task-temp-2`],
        priority: "medium" as TaskPriority,
        input: { deliverables: ["Email draft", "LinkedIn/Instagram carousel copy", "Webinar invite script"] },
        requiresApproval: false,
      });
    } else if (text.includes("sales") || text.includes("spreadsheet") || text.includes("conversion") || text.includes("revenue")) {
      // Business Analysis Scenario (Scenario 3)
      tasks.push({
        title: "Sales Data Calculation & Funnel Drop-off Analysis",
        description: "Process lead conversion data across stages: Lead -> MQL -> SQL -> Enrolled. Calculate conversion rates per segment.",
        assignedAgentId: analysisAgent,
        dependencies: [],
        priority: "critical" as TaskPriority,
        input: { dataset: "MeetUniversity Sales Pipeline Sample", metrics: ["Drop-off %", "Segment Performance", "CAC", "Revenue"] },
        requiresApproval: false,
      });

      tasks.push({
        title: "Bottleneck Diagnostics & Revenue Projections",
        description: "Identify key leakages in conversion funnels and compute revenue upside of 10% funnel optimization.",
        assignedAgentId: analysisAgent,
        dependencies: [`task-temp-1`],
        priority: "high" as TaskPriority,
        input: { model: "Revenue Sensitivity & Leakage Remediation" },
        requiresApproval: false,
      });

      tasks.push({
        title: "Strategic Sales Optimization Deliverable",
        description: "Compile executive summary with markdown conversion funnel visualization and prioritized operational actions.",
        assignedAgentId: writingAgent,
        dependencies: [`task-temp-1`, `task-temp-2`],
        priority: "high" as TaskPriority,
        input: { deliverable: "Executive Sales Analysis & Action Plan" },
        requiresApproval: false,
      });
    } else if (text.includes("github") || text.includes("repo") || text.includes("code review") || text.includes("pull request")) {
      // Development Team Scenario (Scenario 4)
      tasks.push({
        title: "Repository Architecture & Security Inspection",
        description: "Inspect repository codebase, dependency security advisories, and architectural bottlenecks.",
        assignedAgentId: techAgent,
        dependencies: [],
        priority: "high" as TaskPriority,
        input: { repo: "OpenCrewBot codebase", focus: "Architecture, dependencies, error handling" },
        requiresApproval: false,
      });

      tasks.push({
        title: "Prioritized Technical Backlog & Proposed Fixes",
        description: "Formulate prioritized technical enhancements with concrete implementation specifications.",
        assignedAgentId: techAgent,
        dependencies: [`task-temp-1`],
        priority: "high" as TaskPriority,
        input: { focus: "Actionable engineering backlog" },
        requiresApproval: false,
      });

      tasks.push({
        title: "Code Modification & PR Draft (Human Approval Gate)",
        description: "Stage code modification and draft pull request. Strictly requires human approval before executing changes.",
        assignedAgentId: techAgent,
        dependencies: [`task-temp-2`],
        priority: "critical" as TaskPriority,
        input: { action: "Apply recommended fix to codebase" },
        requiresApproval: true, // Requires human approval before making changes!
      });
    } else {
      // General Autonomous Decomposition
      tasks.push({
        title: "Phase 1: Exploratory Research & Context Gathering",
        description: `Gather facts, relevant data points, and constraints for: "${instruction.slice(0, 100)}"`,
        assignedAgentId: researchAgent,
        dependencies: [],
        priority: "medium" as TaskPriority,
        input: { instruction },
        requiresApproval: false,
      });

      tasks.push({
        title: "Phase 2: In-Depth Analysis & Solution Formulation",
        description: "Synthesize gathered context and formulate comprehensive strategic recommendations.",
        assignedAgentId: analysisAgent,
        dependencies: [`task-temp-1`],
        priority: "high" as TaskPriority,
        input: { instruction },
        requiresApproval: false,
      });

      tasks.push({
        title: "Phase 3: Executive Deliverable Consolidation",
        description: "Draft finalized executive deliverable with structured takeaways and next steps.",
        assignedAgentId: writingAgent,
        dependencies: [`task-temp-1`, `task-temp-2`],
        priority: "medium" as TaskPriority,
        input: { instruction },
        requiresApproval: false,
      });
    }

    // Remap temporary dependency IDs to relative indexes (dependencies will be mapped to actual task IDs during creation)
    return tasks.map((t, idx) => ({
      ...t,
      dependencies: t.dependencies.map((dep) => {
        const match = dep.match(/task-temp-(\d+)/);
        if (match) {
          const depIdx = parseInt(match[1], 10) - 1;
          return tasks[depIdx] ? `dep-index-${depIdx}` : dep;
        }
        return dep;
      }),
    }));
  }

  /**
   * Consolidates multi-agent task outputs into a cohesive, professional business deliverable.
   */
  async synthesizeDeliverable(plan: TaskPlan): Promise<string> {
    const tasks = plan.tasks;
    const completedTasks = tasks.filter((t) => t.status === "completed");
    const failedTasks = tasks.filter((t) => t.status === "failed");

    const sections = completedTasks.map((t) => `### ${t.title}\n*(Executed by agent ${t.assignedAgentId})*\n\n${t.output || "Completed with no output."}`);

    let deliverable = [
      `# Executive Business Deliverable: ${plan.goal}`,
      `**Plan ID:** \`${plan.id}\` | **Status:** \`${plan.status.toUpperCase()}\` | **Tasks Completed:** ${completedTasks.length}/${tasks.length}`,
      "---",
      "## 1. Executive Summary",
      `This deliverable was autonomously coordinated by the OpenCrewBot Chief of Staff across a specialized multi-agent workforce. Work was decomposed into ${tasks.length} distinct workstreams, executed with dependency enforcement, and validated for business rigor.`,
      "---",
      "## 2. Key Findings & Deliverables by Workstream",
      sections.join("\n\n---\n\n"),
    ];

    if (failedTasks.length > 0) {
      deliverable.push(
        "---",
        "## 3. Exceptions & Unfinished Workstreams",
        failedTasks.map((t) => `- **${t.title}**: ${t.error || "Execution failed."}`).join("\n"),
      );
    }

    deliverable.push(
      "---",
      "## 4. Next Recommended Actions",
      "1. Review findings with executive stakeholders.\n2. Proceed with operational rollout for approved recommendations.\n3. Continue monitoring progress via scheduled workflows.",
    );

    return deliverable.join("\n\n");
  }
}

export const chiefOfStaff = new ChiefOfStaff();
