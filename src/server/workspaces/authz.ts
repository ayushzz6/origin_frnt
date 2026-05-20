/**
 * Workspace RBAC helpers, layered on top of the platform AuthContext
 * exposed by src/server/authz.ts.
 *
 * Permission model: V1/teacher-admin-launch-plan/06-rbac-and-api-contracts.md
 *
 * Platform admins (origin_users.role = 'admin') always pass workspace
 * permission checks (admin override). Workspace status is checked here so
 * suspended workspaces become read-only for non-admins.
 */

import { AuthzError, type AuthContext, requireAuth } from "@/server/authz";

import { getActiveMembership, getWorkspaceById } from "./store";
import type {
  TeacherWorkspace,
  WorkspaceMember,
  WorkspaceMemberRole,
  WorkspaceStatus,
} from "./types";

const OPERATIONAL_STATUSES: WorkspaceStatus[] = ["active", "trial"];

const ROLE_RANK: Record<WorkspaceMemberRole, number> = {
  owner: 5,
  admin: 4,
  teacher: 3,
  content_manager: 3,
  analyst: 2,
  support: 1,
};

export type WorkspaceAuthContext = {
  auth: AuthContext;
  workspace: TeacherWorkspace;
  membership: WorkspaceMember | null;
  isPlatformAdmin: boolean;
  effectiveRole: WorkspaceMemberRole | "platform_admin";
};

export function isPlatformAdmin(auth: AuthContext): boolean {
  return auth.role === "admin";
}

function hasMinimumRole(role: WorkspaceMemberRole, allowed: WorkspaceMemberRole[]): boolean {
  if (allowed.length === 0) return true;
  return allowed.includes(role);
}

export async function loadWorkspaceContext(
  request: Request,
  workspaceId: string,
): Promise<WorkspaceAuthContext> {
  const auth = await requireAuth(request);
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) {
    throw new AuthzError(403, "Workspace not found or access denied.");
  }
  const platformAdmin = isPlatformAdmin(auth);
  const membership = await getActiveMembership(workspaceId, auth.userId);

  if (!platformAdmin && (!membership || membership.status !== "active")) {
    throw new AuthzError(403, "You are not a member of this workspace.");
  }

  return {
    auth,
    workspace,
    membership,
    isPlatformAdmin: platformAdmin,
    effectiveRole: platformAdmin && !membership ? "platform_admin" : (membership?.role ?? "owner"),
  };
}

export async function requireWorkspaceMember(
  request: Request,
  workspaceId: string,
  allowedRoles: WorkspaceMemberRole[] = [],
): Promise<WorkspaceAuthContext> {
  const context = await loadWorkspaceContext(request, workspaceId);

  if (!context.isPlatformAdmin) {
    if (!OPERATIONAL_STATUSES.includes(context.workspace.status)) {
      throw new AuthzError(403, "This workspace is not operational.");
    }
    if (!context.membership) {
      throw new AuthzError(403, "You are not a member of this workspace.");
    }
    if (!hasMinimumRole(context.membership.role, allowedRoles)) {
      throw new AuthzError(403, "You do not have permission to perform this action.");
    }
  }

  return context;
}

export async function requireWorkspaceOwnerOrAdmin(
  request: Request,
  workspaceId: string,
): Promise<WorkspaceAuthContext> {
  return requireWorkspaceMember(request, workspaceId, ["owner", "admin"]);
}

export function isMutatingRoleAllowed(role: WorkspaceMemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.teacher;
}

export function workspaceMembersThatCanWrite(role: WorkspaceMemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.teacher;
}
