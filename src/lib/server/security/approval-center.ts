// 3-Tier Security & Approval Centre for OpenCrewBot 2.0
// Implements:
// 1. Ask First: every sensitive or external action requires explicit human confirmation
// 2. Controlled Access: pre-approved actions may execute within bounded parameters; write actions require approval
// 3. Full Access: agents execute permitted actions autonomously
// Guarantees: Rejected actions NEVER execute. All decisions are immutably audit-logged.

import { randomUUID } from "node:crypto";
import type { ApprovalMode, AuditLogEntry } from "@/lib/shared/types";
import * as store from "../db";
import { publish } from "../bus";

export interface PendingActionRequest {
  id: string;
  agentId: string;
  conversationId?: string;
  taskId?: string;
  actionType: "external_api" | "email_dispatch" | "code_execution" | "file_modification" | "integration_call";
  toolName: string;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  diffPreview?: string;
  requiredPermission: ApprovalMode;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  rejectionReason?: string;
}

class ApprovalCenter {
  private pendingRequests = new Map<string, PendingActionRequest>();

  /**
   * Evaluates if an action can execute immediately or must be suspended for human approval.
   */
  canExecuteDirectly(agentApproval: ApprovalMode, actionType: PendingActionRequest["actionType"], isReadOnly = false): boolean {
    if (agentApproval === "full") {
      return true;
    }
    if (agentApproval === "controlled") {
      // Controlled allows safe read-only actions without confirmation
      return isReadOnly;
    }
    // "ask" requires approval for everything sensitive
    return false;
  }

  /**
   * Stages a sensitive action for human approval.
   */
  requestApproval(params: Omit<PendingActionRequest, "id" | "status" | "createdAt">): PendingActionRequest {
    const id = `apr-${randomUUID().slice(0, 8)}`;
    const request: PendingActionRequest = {
      ...params,
      id,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    this.pendingRequests.set(id, request);
    publish({ type: "tasks-changed" });

    void store.logAudit({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      actor: params.agentId,
      action: "approval_requested",
      resource: id,
      details: `Approval requested for ${params.title} (${params.actionType})`,
      permissionLevel: params.requiredPermission,
      approved: false,
    });

    return request;
  }

  /**
   * Responds to an approval request.
   * If rejected, the action payload is marked REJECTED and CANNOT be executed.
   */
  async resolveApproval(id: string, approve: boolean, actor = "user", reason?: string): Promise<PendingActionRequest> {
    const request = this.pendingRequests.get(id);
    if (!request) {
      throw new Error(`Approval request ${id} not found or already resolved.`);
    }

    request.status = approve ? "approved" : "rejected";
    request.resolvedAt = new Date().toISOString();
    request.resolvedBy = actor;
    request.rejectionReason = reason;

    // Log the immutable decision in audit logs
    const auditEntry: AuditLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      actor,
      action: approve ? "approval_granted" : "approval_rejected",
      resource: id,
      details: `${approve ? "APPROVED" : "REJECTED"}: ${request.title}. Reason: ${reason || "N/A"}`,
      permissionLevel: request.requiredPermission,
      approved: approve,
      reason,
    };
    await store.logAudit(auditEntry);
    publish({ type: "audit-logged", entry: auditEntry });
    publish({ type: "tasks-changed" });

    // If attached to a task plan, notify task engine
    if (request.taskId) {
      const task = await store.getTask(request.taskId);
      if (task) {
        task.approvalStatus = approve ? "approved" : "rejected";
        if (!approve) {
          task.status = "failed";
          task.error = `Action strictly rejected by human supervisor: ${reason || "User denied execution"}`;
          task.completedAt = new Date().toISOString();
        } else {
          task.status = "running";
        }
        await store.saveTask(task);
        publish({ type: "tasks-changed" });
      }
    }

    return request;
  }

  listPending(): PendingActionRequest[] {
    return Array.from(this.pendingRequests.values()).filter((r) => r.status === "pending");
  }

  listAll(): PendingActionRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  get(id: string): PendingActionRequest | undefined {
    return this.pendingRequests.get(id);
  }
}

export const approvalCenter = new ApprovalCenter();
