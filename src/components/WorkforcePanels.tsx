"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CheckSquare,
  Clock,
  Play,
  Pause,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
  BookOpen,
  ArrowRight,
  ChevronRight,
  Layers,
} from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/client/api";
import { useApp } from "./OpenCrewBotApp";
import { Button, IconButton, inputClass } from "./ui";
import type { Task, TaskPlan, Workflow, WorkflowRun, AuditLogEntry, Skill, ApprovalMode } from "@/lib/shared/types";

// ── 1. Dynamic Agent Factory Modal ──────────────────────────────────────

export function AgentFactoryModal({ onClose }: { onClose: () => void }) {
  const { toast, refresh } = useApp();
  const [prompt, setPrompt] = useState("");
  const [permission, setPermission] = useState<ApprovalMode>("ask");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const generate = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const res = await api.createAgentFromPrompt({ prompt, permissionLevel: permission });
      setResult(res);
      toast(`Created agent ${res.bot.name}!`);
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl bg-raised p-6 shadow-2xl ring-1 ring-line">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Dynamic Agent Factory</h2>
              <p className="text-xs text-mute">Create a specialized AI worker through natural language</p>
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        {!result ? (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-mute">What role or capability should this agent possess?</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Create a Senior EdTech Competitor Intelligence Specialist who benchmarks tuition fees, university tie-ups, and student acquisition funnels."
                rows={4}
                className={clsx(inputClass, "mt-1.5 w-full resize-none rounded-2xl p-3")}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-mute">Default Permission Tier</label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {[
                  { id: "ask", label: "Ask First", desc: "Sensitive actions require confirmation" },
                  { id: "controlled", label: "Controlled", desc: "Safe queries run autonomously" },
                  { id: "full", label: "Full Access", desc: "Autonomous execution" },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setPermission(tier.id as ApprovalMode)}
                    className={clsx(
                      "flex flex-col rounded-xl p-2.5 text-left text-xs transition-colors ring-1",
                      permission === tier.id ? "bg-accent/15 ring-accent text-accent-ink" : "bg-raised-2 ring-line text-mute hover:bg-hover",
                    )}
                  >
                    <span className="font-semibold">{tier.label}</span>
                    <span className="mt-0.5 text-[10px] text-faint">{tier.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" disabled={busy || !prompt.trim()} onClick={generate}>
                {busy ? "Synthesizing Agent…" : "Synthesize & Deploy Agent"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="rounded-2xl bg-raised-2 p-4 ring-1 ring-line">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{result.bot.emoji}</span>
                <div>
                  <h3 className="font-semibold text-ink">{result.bot.name}</h3>
                  <p className="text-xs text-mute">{result.bot.title}</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-mute">{result.bot.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.suggestedSkills.map((s: string) => (
                  <span key={s} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-[#8db4ff]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs text-ok">✓ Agent deployed to workspace without source code modification.</p>
            <div className="flex justify-end">
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 2. Task Execution Dashboard ─────────────────────────────────────────

export function TasksDashboardModal({ onClose }: { onClose: () => void }) {
  const [plans, setPlans] = useState<TaskPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<TaskPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await api.listTasks();
      setPlans(res.plans || []);
      if (res.plans && res.plans.length > 0) {
        setSelectedPlan(res.plans[0]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTasks();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-3xl bg-raised p-6 shadow-2xl ring-1 ring-line">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ok text-white">
              <CheckSquare size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Task Execution Engine & DAG Dashboard</h2>
              <p className="text-xs text-mute">Real-time task dependency monitoring, status, and recovery</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconButton label="Refresh" onClick={fetchTasks}>
              <RefreshCw size={16} />
            </IconButton>
            <IconButton label="Close" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {/* Plan List */}
          <div className="overflow-y-auto space-y-2 border-r border-line pr-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">Orchestration Plans</h3>
            {loading && <p className="text-xs text-mute">Loading plans…</p>}
            {!loading && plans.length === 0 && <p className="text-xs text-mute">No task plans executed yet.</p>}
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlan(p)}
                className={clsx(
                  "w-full rounded-2xl p-3 text-left transition-colors ring-1",
                  selectedPlan?.id === p.id ? "bg-accent/15 ring-accent" : "bg-raised-2 ring-line hover:bg-hover",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-ink truncate">{p.goal}</span>
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      p.status === "completed" && "bg-ok/20 text-ok",
                      p.status === "executing" && "bg-accent/20 text-[#8db4ff] animate-pulse",
                      p.status === "failed" && "bg-danger/20 text-danger",
                      p.status === "interrupted" && "bg-warn/20 text-warn",
                    )}
                  >
                    {p.status}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-faint">{new Date(p.createdAt).toLocaleTimeString()}</p>
              </button>
            ))}
          </div>

          {/* Plan Details & Tasks DAG */}
          <div className="md:col-span-2 overflow-y-auto pl-1 space-y-4">
            {selectedPlan ? (
              <>
                <div className="rounded-2xl bg-raised-2 p-4 ring-1 ring-line">
                  <h4 className="text-xs font-semibold text-faint uppercase">Active Goal</h4>
                  <p className="mt-1 text-sm font-medium text-ink">{selectedPlan.goal}</p>
                  <p className="mt-1 text-xs text-mute">Plan ID: {selectedPlan.id} · Status: {selectedPlan.status}</p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-faint uppercase mb-2">Subtasks & DAG Execution Chain</h4>
                  <div className="space-y-2.5">
                    {selectedPlan.tasks.map((task, idx) => (
                      <div key={task.id} className="rounded-2xl bg-raised-2 p-3.5 ring-1 ring-line">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-raised text-[10px] font-bold text-mute">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-xs text-ink">{task.title}</span>
                          </div>
                          <span
                            className={clsx(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                              task.status === "completed" && "bg-ok/20 text-ok",
                              task.status === "running" && "bg-accent/20 text-[#8db4ff] animate-pulse",
                              task.status === "pending" && "bg-raised text-faint",
                              task.status === "awaiting-approval" && "bg-warn/20 text-warn",
                              task.status === "failed" && "bg-danger/20 text-danger",
                            )}
                          >
                            {task.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-mute">{task.description}</p>
                        {task.dependencies.length > 0 && (
                          <p className="mt-1 text-[11px] text-faint">Dependencies: {task.dependencies.join(", ")}</p>
                        )}
                        {task.output && (
                          <div className="mt-2.5 rounded-xl bg-app p-2.5 text-[11px] leading-relaxed text-mute max-h-36 overflow-y-auto whitespace-pre-wrap">
                            {task.output}
                          </div>
                        )}
                        {task.error && (
                          <p className="mt-1.5 text-xs text-danger font-medium">Error: {task.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedPlan.synthesizedDeliverable && (
                  <div className="rounded-2xl bg-raised-2 p-4 ring-1 ring-line">
                    <h4 className="text-xs font-semibold text-faint uppercase mb-2">Consolidated Executive Deliverable</h4>
                    <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl bg-app p-3 text-xs leading-relaxed text-ink">
                      {selectedPlan.synthesizedDeliverable}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-mute pt-8 text-center">Select an orchestration plan to inspect tasks.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 3. Approval Centre Modal ────────────────────────────────────────────

export function ApprovalCentreModal({ onClose }: { onClose: () => void }) {
  const { toast } = useApp();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/approvals?all=true");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchApprovals();
  }, []);

  const decide = async (id: string, approve: boolean) => {
    try {
      await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approve }),
      });
      toast(approve ? "Action approved and permitted to execute." : "Action strictly rejected. Execution aborted.");
      await fetchApprovals();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to record approval decision");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-3xl bg-raised p-6 shadow-2xl ring-1 ring-line">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warn text-white">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Human Approval Centre</h2>
              <p className="text-xs text-mute">3-Tier Autonomy Control: Review, inspect diffs, and approve or reject actions</p>
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pt-4">
          {loading && <p className="text-xs text-mute">Loading approval queue…</p>}
          {!loading && requests.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <ShieldCheck size={36} className="text-ok mb-2 opacity-80" />
              <p className="text-sm font-semibold text-ink">Approval Queue Clear</p>
              <p className="text-xs text-mute">All external and sensitive agent actions have been resolved.</p>
            </div>
          )}
          {requests.map((r) => (
            <div key={r.id} className="rounded-2xl bg-raised-2 p-4 ring-1 ring-line">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-ink">{r.title}</span>
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    r.status === "pending" && "bg-warn/20 text-warn animate-pulse",
                    r.status === "approved" && "bg-ok/20 text-ok",
                    r.status === "rejected" && "bg-danger/20 text-danger",
                  )}
                >
                  {r.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-mute">{r.description}</p>
              {r.diffPreview && (
                <div className="mt-2.5 rounded-xl bg-app p-3 font-mono text-[11px] leading-relaxed text-mute whitespace-pre-wrap border border-line">
                  {r.diffPreview}
                </div>
              )}
              {r.status === "pending" && (
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => decide(r.id, false)}>
                    Reject Action
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => decide(r.id, true)}>
                    Approve Execution
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 4. Scheduled Workflows Modal ────────────────────────────────────────

export function WorkflowsModal({ onClose }: { onClose: () => void }) {
  const { toast } = useApp();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workflows");
      const data = await res.json();
      setWorkflows(data.workflows || []);
      setRuns(data.recentRuns || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchWorkflows();
  }, []);

  const toggle = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      toast(enabled ? "Workflow resumed" : "Workflow paused");
      await fetchWorkflows();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to toggle workflow");
    }
  };

  const triggerNow = async (id: string) => {
    try {
      toast("Triggering autonomous workflow…");
      await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger" }),
      });
      toast("Routine executed successfully!");
      await fetchWorkflows();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to trigger workflow");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-3xl bg-raised p-6 shadow-2xl ring-1 ring-line">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Scheduled AI Workflows & Automation Engine</h2>
              <p className="text-xs text-mute">Autonomous routines, recurring competitor monitoring, and execution history</p>
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pt-4">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">Configured Workflows</h3>
            {workflows.map((wf) => (
              <div key={wf.id} className="rounded-2xl bg-raised-2 p-4 ring-1 ring-line">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-xs text-ink">{wf.name}</h4>
                    <p className="mt-0.5 text-xs text-mute">{wf.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => triggerNow(wf.id)}>
                      Trigger Now
                    </Button>
                    <Button size="sm" variant={wf.enabled ? "primary" : "secondary"} onClick={() => toggle(wf.id, !wf.enabled)}>
                      {wf.enabled ? "Active" : "Paused"}
                    </Button>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-4 text-[11px] text-faint">
                  <span>Interval: Every {wf.intervalMinutes} min</span>
                  <span>Last run: {wf.lastRunAt ? new Date(wf.lastRunAt).toLocaleTimeString() : "Never"}</span>
                  <span>Next run: {wf.nextRunAt ? new Date(wf.nextRunAt).toLocaleTimeString() : "Paused"}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">Recent Execution History</h3>
            {runs.length === 0 && <p className="text-xs text-mute">No runs recorded yet.</p>}
            {runs.map((r) => (
              <div key={r.id} className="rounded-xl bg-app p-3 text-xs ring-1 ring-line">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">Run {r.id}</span>
                  <span className={clsx("font-semibold text-[10px] uppercase", r.status === "completed" ? "text-ok" : "text-danger")}>
                    {r.status}
                  </span>
                </div>
                {r.output && <p className="mt-1.5 text-mute leading-relaxed max-h-24 overflow-y-auto">{r.output}</p>}
                <p className="mt-1 text-[10px] text-faint">{new Date(r.startedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 5. Skills & Tools Manager Modal ─────────────────────────────────────

export function SkillsModal({ onClose }: { onClose: () => void }) {
  const { toast } = useApp();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [testingSkill, setTestingSkill] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/skills");
      const data = await res.json();
      setSkills(data.skills || []);
    })();
  }, []);

  const runSkill = async (id: string) => {
    setTestingSkill(id);
    setOutput(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: id, input: {} }),
      });
      const data = await res.json();
      setOutput(data.result?.output || "Skill executed successfully.");
      toast(`Executed skill ${id}!`);
    } catch (err) {
      toast("Failed to run skill");
    } finally {
      setTestingSkill(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-3xl bg-raised p-6 shadow-2xl ring-1 ring-line">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
              <Wrench size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Reusable Skills Ecosystem</h2>
              <p className="text-xs text-mute">8 Modular Business Skills available dynamically to agents</p>
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {skills.map((s) => (
              <div key={s.id} className="rounded-2xl bg-raised-2 p-3.5 ring-1 ring-line flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-ink">{s.name}</span>
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-[#8db4ff] uppercase">
                      {s.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-mute leading-snug">{s.description}</p>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="secondary" disabled={testingSkill === s.id} onClick={() => runSkill(s.id)}>
                    {testingSkill === s.id ? "Testing…" : "Test Skill"}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {output && (
            <div className="rounded-2xl bg-raised-2 p-4 ring-1 ring-line">
              <h4 className="text-xs font-semibold text-faint uppercase mb-2">Skill Output</h4>
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-app p-3 font-mono text-[11px] leading-relaxed text-ink border border-line">
                {output}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 6. Persistent Memory Manager Modal ──────────────────────────────────

export function MemoryManagerModal({ onClose }: { onClose: () => void }) {
  const { toast } = useApp();
  const [scope, setScope] = useState<"project" | "room" | "bot">("project");
  const [content, setContent] = useState("");
  const [path, setPath] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchMemory = async (sc: "project" | "room" | "bot") => {
    try {
      const res = await fetch(`/api/memory?scope=${sc}`);
      const data = await res.json();
      setContent(data.content || "");
      setPath(data.path || "");
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void fetchMemory(scope);
  }, [scope]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, content }),
      });
      toast("Memory saved successfully!");
    } catch {
      toast("Failed to save memory");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-3xl bg-raised p-6 shadow-2xl ring-1 ring-line">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ok text-white">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Multi-Tier Memory Manager</h2>
              <p className="text-xs text-mute">Human-editable Markdown memory with provenance tracking across restarts</p>
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <div className="flex items-center gap-2 pt-3">
          {(["project", "room", "bot"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={clsx(
                "rounded-full px-3.5 py-1 text-xs font-semibold capitalize transition-colors ring-1",
                scope === s ? "bg-accent text-white ring-accent" : "bg-raised-2 text-mute ring-line hover:bg-hover",
              )}
            >
              {s} Memory
            </button>
          ))}
        </div>

        <p className="text-[11px] text-faint pt-1 truncate">File: {path}</p>

        <div className="min-h-0 flex-1 pt-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={clsx(inputClass, "h-full w-full resize-none rounded-2xl p-4 font-mono text-xs leading-relaxed")}
          />
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save Memory"}
          </Button>
        </div>
      </div>
    </div>
  );
}
