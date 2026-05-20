/**
 * Workspace lifecycle service. Wraps the lower-level store to encode
 * Phase 1 business rules:
 *
 * - Personal teacher signup yields exactly one personal workspace.
 * - Institute signup yields one institute workspace with the creator as owner.
 * - Audit events follow each lifecycle transition.
 *
 * Org-code creation and code rotation belong to Phase 2 and live in
 * src/server/workspaces/codes.ts.
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "./audit";
import {
  createWorkspaceWithOwner,
  getWorkspaceById,
  listWorkspacesForUser,
  updateWorkspace,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from "./store";
import type { TeacherWorkspace, WorkspaceMembershipSummary } from "./types";

export type WorkspaceCreationInput = CreateWorkspaceInput & {
  requestId?: string | null;
  ipHash?: string | null;
};

export async function createTeacherWorkspace(
  input: WorkspaceCreationInput,
): Promise<TeacherWorkspace> {
  if (!input.displayName.trim()) {
    throw new Error("Workspace name is required.");
  }

  const workspace = await createWorkspaceWithOwner({
    workspaceType: input.workspaceType,
    ownerUserId: input.ownerUserId,
    displayName: input.displayName.trim(),
    legalName: input.legalName?.trim() || null,
    slug: input.slug ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    country: input.country ?? "IN",
    subjects: input.subjects ?? [],
    courses: input.courses ?? [],
    settings: input.settings ?? {},
  });

  await recordAuditEvent({
    actorUserId: input.ownerUserId,
    workspaceId: workspace.id,
    entityType: "teacher_workspace",
    entityId: workspace.id,
    action: "workspace.created",
    after: workspace,
    requestId: input.requestId,
    ipHash: input.ipHash,
  });

  return workspace;
}

export type WorkspaceUpdateInput = UpdateWorkspaceInput & {
  actorUserId: string;
  workspaceId: string;
  requestId?: string | null;
  ipHash?: string | null;
};

export async function patchTeacherWorkspace(
  input: WorkspaceUpdateInput,
): Promise<TeacherWorkspace> {
  const { actorUserId, workspaceId, requestId, ipHash, ...patch } = input;
  const before = await getWorkspaceById(workspaceId);
  if (!before) {
    throw new AuthzError(403, "Workspace not found.");
  }
  const updated = await updateWorkspace(workspaceId, patch);
  if (!updated) {
    throw new AuthzError(403, "Workspace update failed.");
  }
  await recordAuditEvent({
    actorUserId,
    workspaceId,
    entityType: "teacher_workspace",
    entityId: workspaceId,
    action: "workspace.updated",
    before,
    after: updated,
    requestId,
    ipHash,
  });
  return updated;
}

export async function listAccessibleWorkspaces(
  userId: string,
): Promise<WorkspaceMembershipSummary[]> {
  return listWorkspacesForUser(userId);
}
