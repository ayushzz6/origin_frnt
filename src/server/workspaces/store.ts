/**
 * Postgres-backed store for workspaces, members, and codes (Phase 1).
 * Higher-level RBAC checks live in ./authz.ts; this file deals with rows.
 */

import type { Pool, PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

import { createWorkspaceId, createWorkspaceCodeId } from "./ids";
import { ensureWorkspaceSchema } from "./schema";
import type {
  TeacherWorkspace,
  TeacherWorkspaceType,
  WorkspaceCode,
  WorkspaceCodeStatus,
  WorkspaceCodeType,
  WorkspaceMember,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
  WorkspaceMembershipSummary,
  WorkspaceStatus,
  WorkspaceVerificationStatus,
} from "./types";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export function isWorkspaceStoreConfigured(): boolean {
  return isUserPostgresConfigured();
}

function rowToWorkspace(row: Record<string, unknown>): TeacherWorkspace {
  return {
    id: row.id as string,
    workspaceType: row.workspace_type as TeacherWorkspaceType,
    ownerUserId: row.owner_user_id as string,
    displayName: row.display_name as string,
    legalName: (row.legal_name as string | null) ?? null,
    slug: (row.slug as string | null) ?? null,
    logoAssetId: (row.logo_asset_id as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    country: row.country as string,
    subjects: (row.subjects as string[]) ?? [],
    courses: (row.courses as string[]) ?? [],
    status: row.status as WorkspaceStatus,
    verificationStatus: row.verification_status as WorkspaceVerificationStatus,
    publicProfile: (row.public_profile as Record<string, unknown>) ?? {},
    settings: (row.settings as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function rowToMember(row: Record<string, unknown>): WorkspaceMember {
  return {
    workspaceId: row.workspace_id as string,
    userId: row.user_id as string,
    role: row.role as WorkspaceMemberRole,
    status: row.status as WorkspaceMemberStatus,
    invitedBy: (row.invited_by as string | null) ?? null,
    joinedAt: row.joined_at ? new Date(row.joined_at as string).toISOString() : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function rowToCode(row: Record<string, unknown>): WorkspaceCode {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    batchId: (row.batch_id as string | null) ?? null,
    normalizedCode: row.normalized_code as string,
    displayCode: row.display_code as string,
    codeType: row.code_type as WorkspaceCodeType,
    status: row.status as WorkspaceCodeStatus,
    createdBy: row.created_by as string,
    expiresAt: row.expires_at ? new Date(row.expires_at as string).toISOString() : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string).toISOString() : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

export type CreateWorkspaceInput = {
  workspaceType: TeacherWorkspaceType;
  ownerUserId: string;
  displayName: string;
  legalName?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  subjects?: string[];
  courses?: string[];
  settings?: Record<string, unknown>;
};

export async function createWorkspaceWithOwner(input: CreateWorkspaceInput): Promise<TeacherWorkspace> {
  await ensureWorkspaceSchema();
  const id = createWorkspaceId();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const insertWs = await client.query(
      `INSERT INTO app.teacher_workspaces (
         id, workspace_type, owner_user_id, display_name, legal_name, slug,
         city, state, country, subjects, courses, settings
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
       RETURNING *`,
      [
        id,
        input.workspaceType,
        input.ownerUserId,
        input.displayName,
        input.legalName ?? null,
        input.slug ?? null,
        input.city ?? null,
        input.state ?? null,
        input.country ?? "IN",
        input.subjects ?? [],
        input.courses ?? [],
        JSON.stringify(input.settings ?? {}),
      ],
    );
    await client.query(
      `INSERT INTO app.workspace_members (workspace_id, user_id, role, status, joined_at)
       VALUES ($1, $2, 'owner', 'active', NOW())
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      [id, input.ownerUserId],
    );
    await client.query("COMMIT");
    return rowToWorkspace(insertWs.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getWorkspaceById(workspaceId: string): Promise<TeacherWorkspace | null> {
  await ensureWorkspaceSchema();
  const result = await pool().query(
    `SELECT * FROM app.teacher_workspaces WHERE id = $1`,
    [workspaceId],
  );
  return result.rows[0] ? rowToWorkspace(result.rows[0]) : null;
}

export async function getActiveMembership(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMember | null> {
  await ensureWorkspaceSchema();
  const result = await pool().query(
    `SELECT * FROM app.workspace_members
     WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  return result.rows[0] ? rowToMember(result.rows[0]) : null;
}

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceMembershipSummary[]> {
  await ensureWorkspaceSchema();
  const result = await pool().query(
    `SELECT w.*, m.role AS member_role, m.status AS member_status
     FROM app.teacher_workspaces w
     INNER JOIN app.workspace_members m
       ON m.workspace_id = w.id AND m.user_id = $1
     WHERE m.status IN ('active', 'invited')
     ORDER BY w.created_at ASC`,
    [userId],
  );
  return result.rows.map((row) => {
    const workspace = rowToWorkspace(row);
    return {
      ...workspace,
      role: row.member_role as WorkspaceMemberRole,
      memberStatus: row.member_status as WorkspaceMemberStatus,
    };
  });
}

export type UpdateWorkspaceInput = Partial<{
  displayName: string;
  legalName: string | null;
  city: string | null;
  state: string | null;
  country: string;
  subjects: string[];
  courses: string[];
  settings: Record<string, unknown>;
  status: WorkspaceStatus;
}>;

export async function updateWorkspace(
  workspaceId: string,
  patch: UpdateWorkspaceInput,
): Promise<TeacherWorkspace | null> {
  await ensureWorkspaceSchema();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const column: Record<keyof UpdateWorkspaceInput, string> = {
    displayName: "display_name",
    legalName: "legal_name",
    city: "city",
    state: "state",
    country: "country",
    subjects: "subjects",
    courses: "courses",
    settings: "settings",
    status: "status",
  };
  for (const key of Object.keys(patch) as (keyof UpdateWorkspaceInput)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    if (key === "settings") {
      fields.push(`${column[key]} = $${i++}::jsonb`);
      values.push(JSON.stringify(value));
    } else {
      fields.push(`${column[key]} = $${i++}`);
      values.push(value);
    }
  }
  if (fields.length === 0) {
    return getWorkspaceById(workspaceId);
  }
  values.push(workspaceId);
  const result = await pool().query(
    `UPDATE app.teacher_workspaces
     SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id = $${i}
     RETURNING *`,
    values,
  );
  return result.rows[0] ? rowToWorkspace(result.rows[0]) : null;
}

export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  await ensureWorkspaceSchema();
  const result = await pool().query(
    `SELECT * FROM app.workspace_members
     WHERE workspace_id = $1
     ORDER BY created_at ASC`,
    [workspaceId],
  );
  return result.rows.map(rowToMember);
}

export async function upsertMember(input: {
  workspaceId: string;
  userId: string;
  role: WorkspaceMemberRole;
  status?: WorkspaceMemberStatus;
  invitedBy?: string | null;
  markJoined?: boolean;
}): Promise<WorkspaceMember> {
  await ensureWorkspaceSchema();
  const status = input.status ?? "active";
  const joinedAt = input.markJoined !== false ? new Date().toISOString() : null;
  const result = await pool().query(
    `INSERT INTO app.workspace_members (workspace_id, user_id, role, status, invited_by, joined_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (workspace_id, user_id)
     DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, updated_at = NOW()
     RETURNING *`,
    [input.workspaceId, input.userId, input.role, status, input.invitedBy ?? null, joinedAt],
  );
  return rowToMember(result.rows[0]);
}

export async function setMemberStatus(
  workspaceId: string,
  userId: string,
  status: WorkspaceMemberStatus,
): Promise<WorkspaceMember | null> {
  await ensureWorkspaceSchema();
  const result = await pool().query(
    `UPDATE app.workspace_members
     SET status = $3, updated_at = NOW()
     WHERE workspace_id = $1 AND user_id = $2
     RETURNING *`,
    [workspaceId, userId, status],
  );
  return result.rows[0] ? rowToMember(result.rows[0]) : null;
}

// ─── Codes ────────────────────────────────────────────────────────────────────

export async function findActiveCodeByNormalized(
  normalizedCode: string,
): Promise<WorkspaceCode | null> {
  await ensureWorkspaceSchema();
  const result = await pool().query(
    `SELECT * FROM app.workspace_codes
     WHERE normalized_code = $1 AND status IN ('reserved', 'active')
     LIMIT 1`,
    [normalizedCode],
  );
  return result.rows[0] ? rowToCode(result.rows[0]) : null;
}

export async function listCodesForWorkspace(
  workspaceId: string,
  codeType?: WorkspaceCodeType,
): Promise<WorkspaceCode[]> {
  await ensureWorkspaceSchema();
  const params: unknown[] = [workspaceId];
  let typeFilter = "";
  if (codeType) {
    params.push(codeType);
    typeFilter = " AND code_type = $2";
  }
  const result = await pool().query(
    `SELECT * FROM app.workspace_codes
     WHERE workspace_id = $1${typeFilter}
     ORDER BY created_at DESC`,
    params,
  );
  return result.rows.map(rowToCode);
}

export async function createWorkspaceCode(input: {
  workspaceId: string;
  normalizedCode: string;
  displayCode: string;
  codeType: WorkspaceCodeType;
  createdBy: string;
  batchId?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
  client?: PoolClient;
}): Promise<WorkspaceCode> {
  await ensureWorkspaceSchema();
  const runner = input.client ?? pool();
  const id = createWorkspaceCodeId();
  const result = await runner.query(
    `INSERT INTO app.workspace_codes (
       id, workspace_id, batch_id, normalized_code, display_code,
       code_type, status, created_by, expires_at, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9::jsonb)
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.batchId ?? null,
      input.normalizedCode,
      input.displayCode,
      input.codeType,
      input.createdBy,
      input.expiresAt ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return rowToCode(result.rows[0]);
}

export async function revokeWorkspaceCode(
  codeId: string,
  workspaceId: string,
): Promise<WorkspaceCode | null> {
  await ensureWorkspaceSchema();
  const result = await pool().query(
    `UPDATE app.workspace_codes
     SET status = 'revoked', revoked_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND status IN ('reserved', 'active')
     RETURNING *`,
    [codeId, workspaceId],
  );
  return result.rows[0] ? rowToCode(result.rows[0]) : null;
}

export async function findWorkspaceByActiveStudentJoinCode(
  normalizedCode: string,
): Promise<{ workspace: TeacherWorkspace; code: WorkspaceCode } | null> {
  await ensureWorkspaceSchema();
  const result = await pool().query(
    `SELECT w.*, c.id AS code_id, c.normalized_code, c.display_code, c.code_type,
            c.status AS code_status, c.created_by AS code_created_by, c.expires_at AS code_expires_at,
            c.revoked_at AS code_revoked_at, c.metadata AS code_metadata, c.batch_id AS code_batch_id,
            c.created_at AS code_created_at
     FROM app.workspace_codes c
     INNER JOIN app.teacher_workspaces w ON w.id = c.workspace_id
     WHERE c.normalized_code = $1
       AND c.status = 'active'
       AND c.code_type = 'student_join'
       AND (c.expires_at IS NULL OR c.expires_at > NOW())
     LIMIT 1`,
    [normalizedCode],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    workspace: rowToWorkspace(row),
    code: rowToCode({
      id: row.code_id,
      workspace_id: row.id,
      batch_id: row.code_batch_id,
      normalized_code: row.normalized_code,
      display_code: row.display_code,
      code_type: row.code_type,
      status: row.code_status,
      created_by: row.code_created_by,
      expires_at: row.code_expires_at,
      revoked_at: row.code_revoked_at,
      metadata: row.code_metadata,
      created_at: row.code_created_at,
    }),
  };
}
