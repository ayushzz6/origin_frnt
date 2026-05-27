/**
 * Server-side helpers for React Server Components to fetch workspace data
 * directly without going through the public API.
 */

import { redirect } from "next/navigation";
import { cache } from "react";

import { getServerUser } from "@/lib/auth-server";

import { getActiveMembership, getWorkspaceById, listWorkspacesForUser } from "./store";
import type {
  TeacherWorkspace,
  WorkspaceMember,
  WorkspaceMembershipSummary,
} from "./types";

export const loadAccessibleWorkspaces = cache(async function loadAccessibleWorkspaces(): Promise<WorkspaceMembershipSummary[]> {
  const user = await getServerUser();
  if (!user) redirect("/auth?next=/teacher");
  return listWorkspacesForUser(user.id);
});

export type WorkspaceServerContext = {
  workspace: TeacherWorkspace;
  membership: WorkspaceMember | null;
  isPlatformAdmin: boolean;
  userId: string;
};

export const loadWorkspaceForRender = cache(async function loadWorkspaceForRender(workspaceId: string): Promise<WorkspaceServerContext> {
  const user = await getServerUser();
  if (!user) redirect(`/auth?next=/teacher/workspaces/${workspaceId}`);

  // Fetch workspace and membership status in parallel
  const [workspace, membership] = await Promise.all([
    getWorkspaceById(workspaceId),
    getActiveMembership(workspaceId, user.id),
  ]);

  if (!workspace) redirect("/teacher");
  const isPlatformAdmin = user.role === "admin";
  if (!isPlatformAdmin && (!membership || membership.status !== "active")) {
    redirect("/teacher");
  }
  return {
    workspace,
    membership,
    isPlatformAdmin,
    userId: user.id,
  };
});

export type WorkspaceLayoutData = {
  context: WorkspaceServerContext;
  accessible: WorkspaceMembershipSummary[];
};

export const loadWorkspaceLayoutData = cache(async function loadWorkspaceLayoutData(workspaceId: string): Promise<WorkspaceLayoutData> {
  const user = await getServerUser();
  if (!user) redirect(`/auth?next=/teacher/workspaces/${workspaceId}`);

  // Fetch workspace details, active membership status, and accessible list in parallel
  const [workspace, membership, accessible] = await Promise.all([
    getWorkspaceById(workspaceId),
    getActiveMembership(workspaceId, user.id),
    listWorkspacesForUser(user.id),
  ]);

  if (!workspace) redirect("/teacher");
  const isPlatformAdmin = user.role === "admin";
  if (!isPlatformAdmin && (!membership || membership.status !== "active")) {
    redirect("/teacher");
  }

  return {
    context: {
      workspace,
      membership,
      isPlatformAdmin,
      userId: user.id,
    },
    accessible,
  };
});
