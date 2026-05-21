/**
 * Admin control center store (Phase 11).
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureDocumentImportSchema } from "./document-import-schema";
import type { AdminAuditEvent, AdminUserSearchResult, WorkspaceAdminSummary, WorkspaceSuspensionReason } from "./types";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export async function searchWorkspaces(query: string, filter?: { workspaceType?: "personal" | "institute"; status?: "active" | "suspended" | "all" }, limit?: number): Promise<WorkspaceAdminSummary[]> {
  await ensureDocumentImportSchema();
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (query) { params.push(`%${query}%`); conditions.push(`(w.display_name ILIKE $${params.length} OR w.slug ILIKE $${params.length})`); }
  if (filter?.workspaceType) { params.push(filter.workspaceType); conditions.push(`w.workspace_type = $${params.length}`); }
  if (filter?.status && filter.status !== "all") { params.push(filter.status); conditions.push(`w.status = $${params.length}`); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const maxLimit = limit ?? 50;
  const result = await pool().query(
    `SELECT w.id, w.workspace_type, w.display_name, w.owner_user_id, w.status, w.created_at, w.verification_status,
            u.name AS owner_name, u.email AS owner_email,
            COALESCE(sc.student_count, 0) AS student_count, COALESCE(bc.batch_count, 0) AS batch_count
     FROM app.teacher_workspaces w
     LEFT JOIN origin_users u ON u.id = w.owner_user_id
     LEFT JOIN (SELECT workspace_id, COUNT(*) AS student_count FROM app.workspace_student_enrollments WHERE status = 'active' GROUP BY workspace_id) sc ON sc.workspace_id = w.id
     LEFT JOIN (SELECT workspace_id, COUNT(*) AS batch_count FROM app.batches WHERE status IN ('active', 'draft') GROUP BY workspace_id) bc ON bc.workspace_id = w.id
     ${where} ORDER BY w.created_at DESC LIMIT $${params.length + 1}`,
    [...params, maxLimit],
  );
  return result.rows.map((row) => ({
    id: row.id as string, workspaceType: row.workspace_type as "personal" | "institute",
    displayName: row.display_name as string, ownerUserId: row.owner_user_id as string,
    ownerName: (row.owner_name as string | null) ?? null, ownerEmail: (row.owner_email as string | null) ?? null,
    status: row.status as "active" | "trial" | "suspended" | "closed",
    studentCount: Number(row.student_count) || 0, batchCount: Number(row.batch_count) || 0,
    questionCount: 0, createdAt: new Date(row.created_at as string).toISOString(),
    suspendedAt: null, suspensionReason: null,
  }));
}

export async function suspendWorkspace(workspaceId: string, _reason?: WorkspaceSuspensionReason, _notes?: string | null): Promise<boolean> {
  await ensureDocumentImportSchema();
  const result = await pool().query(`UPDATE app.teacher_workspaces SET status = 'suspended', updated_at = NOW() WHERE id = $1 AND status NOT IN ('closed') RETURNING id`, [workspaceId]);
  return (result.rowCount ?? 0) > 0;
}

export async function unsuspendWorkspace(workspaceId: string): Promise<boolean> {
  await ensureDocumentImportSchema();
  const result = await pool().query(`UPDATE app.teacher_workspaces SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'suspended' RETURNING id`, [workspaceId]);
  return (result.rowCount ?? 0) > 0;
}

export async function closeWorkspace(workspaceId: string): Promise<boolean> {
  await ensureDocumentImportSchema();
  const result = await pool().query(`UPDATE app.teacher_workspaces SET status = 'closed', updated_at = NOW() WHERE id = $1 AND status NOT IN ('closed') RETURNING id`, [workspaceId]);
  return (result.rowCount ?? 0) > 0;
}

export async function searchUsers(query: string, filter?: { role?: "student" | "teacher" | "admin" }, limit?: number): Promise<AdminUserSearchResult[]> {
  await ensureDocumentImportSchema();
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (query) { params.push(`%${query}%`); conditions.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
  if (filter?.role) { params.push(filter.role); conditions.push(`u.role = $${params.length}`); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const maxLimit = limit ?? 50;
  const result = await pool().query(`SELECT u.id, u.name, u.email, u.role, u.created_at FROM origin_users u ${where} ORDER BY u.created_at DESC LIMIT $${params.length + 1}`, [...params, maxLimit]);
  const users = result.rows.map((row) => ({
    id: row.id as string, name: row.name as string, email: row.email as string,
    role: row.role as "student" | "teacher" | "admin",
    workspaceMemberships: [] as { workspaceId: string; workspaceName: string; role: string }[],
    createdAt: new Date(row.created_at as string).toISOString(),
  }));
  if (users.length > 0) {
    const userIds = users.map((u) => u.id);
    const membershipsResult = await pool().query(
      `SELECT m.user_id, m.workspace_id, m.role, w.display_name AS workspace_name
       FROM app.workspace_members m INNER JOIN app.teacher_workspaces w ON w.id = m.workspace_id
       WHERE m.user_id = ANY($1) AND m.status = 'active' ORDER BY m.user_id, w.created_at`,
      [userIds],
    );
    const membershipMap = new Map<string, { workspaceId: string; workspaceName: string; role: string }[]>();
    for (const row of membershipsResult.rows) {
      const userId = row.user_id as string;
      if (!membershipMap.has(userId)) membershipMap.set(userId, []);
      membershipMap.get(userId)!.push({ workspaceId: row.workspace_id as string, workspaceName: row.workspace_name as string, role: row.role as string });
    }
    for (const user of users) user.workspaceMemberships = membershipMap.get(user.id) ?? [];
  }
  return users;
}

export async function listAuditEvents(filter?: { workspaceId?: string; entityType?: string; actorUserId?: string; action?: string; limit?: number; offset?: number }): Promise<AdminAuditEvent[]> {
  await ensureDocumentImportSchema();
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (filter?.workspaceId) { params.push(filter.workspaceId); conditions.push(`ae.workspace_id = $${params.length}`); }
  if (filter?.entityType) { params.push(filter.entityType); conditions.push(`ae.entity_type = $${params.length}`); }
  if (filter?.actorUserId) { params.push(filter.actorUserId); conditions.push(`ae.actor_user_id = $${params.length}`); }
  if (filter?.action) { params.push(filter.action); conditions.push(`ae.action = $${params.length}`); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filter?.limit ?? 50;
  const offset = filter?.offset ?? 0;
  const result = await pool().query(
    `SELECT ae.*, u.name AS actor_name, w.display_name AS workspace_name
     FROM app.audit_events ae
     LEFT JOIN origin_users u ON u.id = ae.actor_user_id
     LEFT JOIN app.teacher_workspaces w ON w.id = ae.workspace_id
     ${where} ORDER BY ae.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return result.rows.map((row) => ({
    id: row.id as string, actorUserId: (row.actor_user_id as string | null) ?? null,
    actorName: (row.actor_name as string | null) ?? null, workspaceId: (row.workspace_id as string | null) ?? null,
    workspaceName: (row.workspace_name as string | null) ?? null, entityType: row.entity_type as string,
    entityId: row.entity_id as string, action: row.action as string,
    before: (row.before as Record<string, unknown> | null) ?? null,
    after: (row.after as Record<string, unknown> | null) ?? null,
    requestId: (row.request_id as string | null) ?? null, ipHash: (row.ip_hash as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
  }));
}
