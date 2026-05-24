/**
 * Phase 13 incident-control service — wraps the raw incident store with
 * audit-event recording and admin-only authorization.
 *
 * Each mutation (kill-switch, force-logout, rate-limit dial, workspace
 * close) writes one app.audit_events row tagged with entity_type
 * "incident" so the platform admin team can reconstruct any incident
 * from the audit log alone.
 */

import { dbIncrementAuthTokenVersionAndRevokeSessions, dbFindUserById } from "@/server/db-users";
import type { FlagKey } from "@/lib/feature-flags";

import {
  getIncidentSnapshot,
  setFlagOverride,
  setRateLimitMode,
  type RateLimitMode,
} from "./incidents";
import { closeWorkspaceService } from "./workspaces/admin-service";
import { recordAuditEvent } from "./workspaces/audit";

export type IncidentAction =
  | "kill_switch"
  | "force_logout"
  | "rate_limit"
  | "close_workspace";

export type IncidentContext = {
  adminUserId: string;
  requestId?: string | null;
};

export async function applyKillSwitch(input: IncidentContext & {
  flag: FlagKey;
  value: "on" | "off" | "clear";
  reason?: string | null;
}): Promise<void> {
  const before = await getIncidentSnapshot();
  await setFlagOverride(input.flag, input.value);
  const after = await getIncidentSnapshot();
  await recordAuditEvent({
    actorUserId: input.adminUserId,
    workspaceId: null,
    entityType: "incident",
    entityId: `flag:${input.flag}`,
    action: "incident.kill_switch",
    before: { override: before.flagOverrides[input.flag] ?? null },
    after: { override: after.flagOverrides[input.flag] ?? null, reason: input.reason ?? null },
    requestId: input.requestId,
  });
}

export async function applyForceLogout(input: IncidentContext & {
  targetUserId: string;
  reason?: string | null;
}): Promise<{ found: boolean }> {
  const target = await dbFindUserById(input.targetUserId);
  if (!target) return { found: false };
  await dbIncrementAuthTokenVersionAndRevokeSessions(input.targetUserId);
  await recordAuditEvent({
    actorUserId: input.adminUserId,
    workspaceId: null,
    entityType: "incident",
    entityId: `user:${input.targetUserId}`,
    action: "incident.force_logout",
    before: { authTokenVersion: target.authTokenVersion ?? 0 },
    after: { authTokenVersion: (target.authTokenVersion ?? 0) + 1, reason: input.reason ?? null },
    requestId: input.requestId,
  });
  return { found: true };
}

export async function applyRateLimitMode(input: IncidentContext & {
  mode: RateLimitMode;
  reason?: string | null;
}): Promise<void> {
  const before = await getIncidentSnapshot();
  await setRateLimitMode(input.mode);
  await recordAuditEvent({
    actorUserId: input.adminUserId,
    workspaceId: null,
    entityType: "incident",
    entityId: "rate-limit-mode",
    action: "incident.rate_limit",
    before: { mode: before.rateLimitMode },
    after: { mode: input.mode, reason: input.reason ?? null },
    requestId: input.requestId,
  });
}

export async function applyCloseWorkspace(input: IncidentContext & {
  workspaceId: string;
  reason?: string | null;
}): Promise<{ closed: boolean }> {
  const closed = await closeWorkspaceService({
    workspaceId: input.workspaceId,
    adminUserId: input.adminUserId,
    requestId: input.requestId,
  });
  // closeWorkspaceService already audits "workspace.closed". Add a
  // separate "incident.close_workspace" entry so this action shows up
  // in the incident timeline regardless of which channel triggered it.
  await recordAuditEvent({
    actorUserId: input.adminUserId,
    workspaceId: input.workspaceId,
    entityType: "incident",
    entityId: `workspace:${input.workspaceId}`,
    action: "incident.close_workspace",
    after: { closed, reason: input.reason ?? null },
    requestId: input.requestId,
  });
  return { closed };
}
