/**
 * Data store for app.origin_collaborations (Phase 14, section A).
 * Aligned to src/db/migrations/20260604_phase14_collaborations.sql.
 *
 * A collaboration is the partner-lifecycle record for an institute workspace.
 * Both enrollment flows light up iff the collaboration `status` is `active` AND
 * the underlying workspace is an `institute` with workspace `status` = `active`.
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";
import { createCollaborationId } from "@/server/workspaces/ids";

import { ensureCollaborationSchema } from "./collaboration-schema";

export type CollaborationStatus = "pending" | "active" | "paused" | "terminated" | "rejected";

export type Collaboration = {
  id: string;
  workspaceId: string;
  status: CollaborationStatus;
  commissionBps: number;
  razorpayRouteAccountId: string | null;
  flow1Enabled: boolean;
  flow2Enabled: boolean;
  requestedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToCollaboration(row: Record<string, unknown>): Collaboration {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    status: row.status as CollaborationStatus,
    commissionBps: Number(row.commission_bps) || 0,
    razorpayRouteAccountId: (row.razorpay_route_account_id as string | null) ?? null,
    flow1Enabled: Boolean(row.flow1_enabled),
    flow2Enabled: Boolean(row.flow2_enabled),
    requestedBy: (row.requested_by as string | null) ?? null,
    approvedBy: (row.approved_by as string | null) ?? null,
    approvedAt: row.approved_at ? new Date(row.approved_at as string).toISOString() : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export async function getCollaborationByWorkspace(
  workspaceId: string,
): Promise<Collaboration | null> {
  await ensureCollaborationSchema();
  const res = await pool().query(
    `SELECT * FROM app.origin_collaborations WHERE workspace_id = $1`,
    [workspaceId],
  );
  return res.rows[0] ? rowToCollaboration(res.rows[0]) : null;
}

/**
 * Upserts the collaboration request for a workspace. If no row exists one is
 * created in `pending`; if a row already exists it is returned unchanged (a
 * teacher re-requesting does not reset an approved/terminated lifecycle).
 */
export async function upsertCollaborationRequest(input: {
  workspaceId: string;
  requestedBy: string;
  metadata?: Record<string, unknown>;
}): Promise<{ collaboration: Collaboration; created: boolean }> {
  await ensureCollaborationSchema();
  const id = createCollaborationId();
  const res = await pool().query(
    `INSERT INTO app.origin_collaborations (id, workspace_id, status, requested_by, metadata)
     VALUES ($1, $2, 'pending', $3, $4::jsonb)
     ON CONFLICT (workspace_id) DO NOTHING
     RETURNING *`,
    [id, input.workspaceId, input.requestedBy, JSON.stringify(input.metadata ?? {})],
  );
  if (res.rows[0]) return { collaboration: rowToCollaboration(res.rows[0]), created: true };
  const existing = await getCollaborationByWorkspace(input.workspaceId);
  if (!existing) throw new Error("Failed to upsert collaboration request.");
  return { collaboration: existing, created: false };
}

export type SetCollaborationStatusPatch = {
  status: CollaborationStatus;
  approvedBy?: string | null;
  commissionBps?: number | null;
  razorpayRouteAccountId?: string | null;
  flow1Enabled?: boolean | null;
  flow2Enabled?: boolean | null;
};

export async function setCollaborationStatus(
  workspaceId: string,
  patch: SetCollaborationStatusPatch,
): Promise<Collaboration | null> {
  await ensureCollaborationSchema();
  const fields: string[] = ["status = $2", "updated_at = NOW()"];
  const params: unknown[] = [workspaceId, patch.status];
  let i = 3;
  // Stamp approval metadata only on the transition into `active`.
  if (patch.status === "active") {
    fields.push(`approved_at = COALESCE(approved_at, NOW())`);
    if (patch.approvedBy !== undefined && patch.approvedBy !== null) {
      fields.push(`approved_by = $${i++}`);
      params.push(patch.approvedBy);
    }
  }
  if (patch.commissionBps !== undefined && patch.commissionBps !== null) {
    fields.push(`commission_bps = $${i++}`);
    params.push(patch.commissionBps);
  }
  if (patch.razorpayRouteAccountId !== undefined) {
    fields.push(`razorpay_route_account_id = $${i++}`);
    params.push(patch.razorpayRouteAccountId);
  }
  if (patch.flow1Enabled !== undefined && patch.flow1Enabled !== null) {
    fields.push(`flow1_enabled = $${i++}`);
    params.push(patch.flow1Enabled);
  }
  if (patch.flow2Enabled !== undefined && patch.flow2Enabled !== null) {
    fields.push(`flow2_enabled = $${i++}`);
    params.push(patch.flow2Enabled);
  }
  const res = await pool().query(
    `UPDATE app.origin_collaborations SET ${fields.join(", ")} WHERE workspace_id = $1 RETURNING *`,
    params,
  );
  return res.rows[0] ? rowToCollaboration(res.rows[0]) : null;
}

export type CollaborationWithWorkspace = Collaboration & {
  workspaceDisplayName: string;
  workspaceType: string;
  workspaceStatus: string;
};

/** Admin list — collaborations joined to their workspace, newest first. */
export async function listCollaborations(filter?: {
  status?: CollaborationStatus | "all";
}): Promise<CollaborationWithWorkspace[]> {
  await ensureCollaborationSchema();
  const params: unknown[] = [];
  let where = "";
  if (filter?.status && filter.status !== "all") {
    params.push(filter.status);
    where = `WHERE c.status = $${params.length}`;
  }
  const res = await pool().query(
    `SELECT c.*, w.display_name AS workspace_display_name,
            w.workspace_type AS workspace_type, w.status AS workspace_status
       FROM app.origin_collaborations c
       INNER JOIN app.teacher_workspaces w ON w.id = c.workspace_id
       ${where}
       ORDER BY c.created_at DESC`,
    params,
  );
  return res.rows.map((row) => ({
    ...rowToCollaboration(row),
    workspaceDisplayName: (row.workspace_display_name as string | null) ?? "",
    workspaceType: (row.workspace_type as string | null) ?? "",
    workspaceStatus: (row.workspace_status as string | null) ?? "",
  }));
}

/**
 * True iff the workspace is a live collaborator: its collaboration row is
 * `active` AND the workspace is an `institute` with workspace `status` = `active`.
 */
export async function isActiveCollaboration(workspaceId: string): Promise<boolean> {
  await ensureCollaborationSchema();
  const res = await pool().query(
    `SELECT 1
       FROM app.origin_collaborations c
       INNER JOIN app.teacher_workspaces w ON w.id = c.workspace_id
      WHERE c.workspace_id = $1
        AND c.status = 'active'
        AND w.status = 'active'
        AND w.workspace_type = 'institute'
      LIMIT 1`,
    [workspaceId],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Workspace ids of every live collaborator (used to scope student browse). */
export async function listActiveCollaborationWorkspaceIds(): Promise<string[]> {
  await ensureCollaborationSchema();
  const res = await pool().query<{ workspace_id: string }>(
    `SELECT c.workspace_id
       FROM app.origin_collaborations c
       INNER JOIN app.teacher_workspaces w ON w.id = c.workspace_id
      WHERE c.status = 'active'
        AND w.status = 'active'
        AND w.workspace_type = 'institute'`,
  );
  return res.rows.map((r) => r.workspace_id);
}
