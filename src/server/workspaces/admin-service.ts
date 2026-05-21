/**
 * Admin control center service (Phase 11).
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "./audit";
import { closeWorkspace, listAuditEvents, searchUsers, searchWorkspaces, suspendWorkspace, unsuspendWorkspace } from "./admin-store";
import { getWorkspaceById } from "./store";
import type { AdminAuditEvent, AdminUserSearchResult, WorkspaceAdminSummary, WorkspaceSuspensionReason } from "./types";

export async function searchWorkspacesService(query: string, filter?: { workspaceType?: "personal" | "institute"; status?: "active" | "suspended" | "all" }, limit?: number): Promise<WorkspaceAdminSummary[]> {
  return searchWorkspaces(query, filter, limit);
}

export async function suspendWorkspaceService(input: { workspaceId: string; reason: WorkspaceSuspensionReason; notes?: string | null; adminUserId: string; requestId?: string | null }): Promise<boolean> {
  const workspace = await getWorkspaceById(input.workspaceId);
  if (!workspace) throw new AuthzError(403, "Workspace not found.");
  if (workspace.status === "suspended") throw new Error("Workspace is already suspended.");
  const suspended = await suspendWorkspace(input.workspaceId, input.reason, input.notes);
  if (suspended) await recordAuditEvent({ actorUserId: input.adminUserId, workspaceId: input.workspaceId, entityType: "teacher_workspace", entityId: input.workspaceId, action: "workspace.suspended", before: workspace, after: { ...workspace, status: "suspended" }, requestId: input.requestId });
  return suspended;
}

export async function unsuspendWorkspaceService(input: { workspaceId: string; adminUserId: string; requestId?: string | null }): Promise<boolean> {
  const workspace = await getWorkspaceById(input.workspaceId);
  if (!workspace) throw new AuthzError(403, "Workspace not found.");
  if (workspace.status !== "suspended") throw new Error("Workspace is not suspended.");
  const unsuspended = await unsuspendWorkspace(input.workspaceId);
  if (unsuspended) await recordAuditEvent({ actorUserId: input.adminUserId, workspaceId: input.workspaceId, entityType: "teacher_workspace", entityId: input.workspaceId, action: "workspace.unsuspended", before: workspace, after: { ...workspace, status: "active" }, requestId: input.requestId });
  return unsuspended;
}

export async function closeWorkspaceService(input: { workspaceId: string; adminUserId: string; requestId?: string | null }): Promise<boolean> {
  const workspace = await getWorkspaceById(input.workspaceId);
  if (!workspace) throw new AuthzError(403, "Workspace not found.");
  const closed = await closeWorkspace(input.workspaceId);
  if (closed) await recordAuditEvent({ actorUserId: input.adminUserId, workspaceId: input.workspaceId, entityType: "teacher_workspace", entityId: input.workspaceId, action: "workspace.closed", before: workspace, after: { ...workspace, status: "closed" }, requestId: input.requestId });
  return closed;
}

export async function searchUsersService(query: string, filter?: { role?: "student" | "teacher" | "admin" }, limit?: number): Promise<AdminUserSearchResult[]> {
  return searchUsers(query, filter, limit);
}

export async function listAuditEventsService(filter?: { workspaceId?: string; entityType?: string; actorUserId?: string; action?: string; limit?: number; offset?: number }): Promise<AdminAuditEvent[]> {
  return listAuditEvents(filter);
}
