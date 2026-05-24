/**
 * Admin control center service (Phase 11).
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "./audit";
import { closeWorkspace, getImportJobAdmin, listAllImportJobs, listAuditEvents, searchUsers, searchWorkspaces, suspendWorkspace, unsuspendWorkspace } from "./admin-store";
import { getWorkspaceById, revokeWorkspaceCode, updateWorkspace, type UpdateWorkspaceInput } from "./store";
import type { AdminAuditEvent, AdminUserSearchResult, DocumentImportJob, ImportJobStatus, TeacherWorkspace, WorkspaceAdminSummary, WorkspaceCode, WorkspaceSuspensionReason } from "./types";

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

/** Platform-admin edit of a workspace's profile fields (admin override —
 * the workspace owner doesn't need to consent). Writes one audit event
 * per call. */
export async function updateWorkspaceAdminService(input: {
  workspaceId: string;
  patch: UpdateWorkspaceInput;
  adminUserId: string;
  requestId?: string | null;
}): Promise<TeacherWorkspace | null> {
  const before = await getWorkspaceById(input.workspaceId);
  if (!before) return null;
  const after = await updateWorkspace(input.workspaceId, input.patch);
  if (after) {
    await recordAuditEvent({
      actorUserId: input.adminUserId,
      workspaceId: input.workspaceId,
      entityType: "teacher_workspace",
      entityId: input.workspaceId,
      action: "workspace.admin_updated",
      before,
      after,
      requestId: input.requestId,
    });
  }
  return after;
}

export async function listAllImportJobsAdminService(filter?: {
  workspaceId?: string;
  status?: ImportJobStatus;
  limit?: number;
}): Promise<DocumentImportJob[]> {
  return listAllImportJobs(filter);
}

export async function getImportJobAdminService(jobId: string): Promise<DocumentImportJob | null> {
  return getImportJobAdmin(jobId);
}

/** Platform-admin revocation of a workspace code (e.g. leaked join code).
 * Returns null when the code is already revoked / expired / not found. */
export async function adminRevokeWorkspaceCodeService(input: {
  workspaceId: string;
  codeId: string;
  adminUserId: string;
  requestId?: string | null;
}): Promise<WorkspaceCode | null> {
  const revoked = await revokeWorkspaceCode(input.codeId, input.workspaceId);
  if (revoked) {
    await recordAuditEvent({
      actorUserId: input.adminUserId,
      workspaceId: input.workspaceId,
      entityType: "workspace_code",
      entityId: input.codeId,
      action: "workspace_code.revoked_by_admin",
      after: revoked,
      requestId: input.requestId,
    });
  }
  return revoked;
}
