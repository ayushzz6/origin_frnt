/**
 * Server-side helpers for React Server Components to fetch workspace data
 * directly without going through the public API.
 */

import { redirect } from "next/navigation";

import { getServerUser } from "@/lib/auth-server";

import { getActiveMembership, getWorkspaceById, listWorkspacesForUser } from "./store";
import type {
  TeacherWorkspace,
  WorkspaceMember,
  WorkspaceMembershipSummary,
} from "./types";

export async function loadAccessibleWorkspaces(): Promise<WorkspaceMembershipSummary[]> {
  const user = await getServerUser();
  if (!user) redirect("/auth?next=/teacher");
  return listWorkspacesForUser(user.id);
}

export type WorkspaceServerContext = {
  workspace: TeacherWorkspace;
  membership: WorkspaceMember | null;
  isPlatformAdmin: boolean;
  userId: string;
};

export async function loadWorkspaceForRender(workspaceId: string): Promise<WorkspaceServerContext> {
  const user = await getServerUser();
  if (!user) redirect(`/auth?next=/teacher/workspaces/${workspaceId}`);
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) redirect("/teacher");
  const isPlatformAdmin = user.role === "admin";
  const membership = await getActiveMembership(workspaceId, user.id);
  if (!isPlatformAdmin && (!membership || membership.status !== "active")) {
    redirect("/teacher");
  }
  return {
    workspace,
    membership,
    isPlatformAdmin,
    userId: user.id,
  };
}
