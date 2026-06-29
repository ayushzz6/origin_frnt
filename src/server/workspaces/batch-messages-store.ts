/**
 * Batch communication hub — a small per-batch message feed shared by the teacher
 * and the batch's enrolled students (Telegram/WhatsApp-style). Polling-based; no
 * realtime sockets in v1. Lives in `content.batch_messages` (USER DB).
 */

import type { PoolClient } from "pg";

import { createPrefixedId } from "./ids";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originBatchMessagesSchemaEnsured: boolean | undefined;
  var __originBatchMessagesSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260629_batch_messages";

export type BatchMessageSenderRole = "teacher" | "student";
export type BatchMessageKind = "text" | "link";

export type BatchMessage = {
  id: string;
  workspaceId: string;
  batchId: string;
  senderId: string;
  senderRole: BatchMessageSenderRole;
  senderName: string | null;
  body: string;
  kind: BatchMessageKind;
  linkUrl: string | null;
  createdAt: string;
};

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export async function ensureBatchMessagesSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originBatchMessagesSchemaEnsured) return;
  if (!globalThis.__originBatchMessagesSchemaPromise) {
    globalThis.__originBatchMessagesSchemaPromise = (async () => {
      const client: PoolClient = await pool().connect();
      try {
        await client.query("BEGIN");
        await client.query(`CREATE SCHEMA IF NOT EXISTS content`);
        await client.query(`
          CREATE TABLE IF NOT EXISTS content.batch_messages (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
            sender_id TEXT NOT NULL REFERENCES origin_users(id),
            sender_role TEXT NOT NULL CHECK (sender_role IN ('teacher', 'student')),
            body TEXT NOT NULL,
            kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'link')),
            link_url TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_batch_messages_batch
            ON content.batch_messages(workspace_id, batch_id, created_at DESC);
        `);
        await client.query(
          "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
          [MIGRATION_ID, "batch communication hub"],
        );
        await client.query("COMMIT");
        globalThis.__originBatchMessagesSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originBatchMessagesSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originBatchMessagesSchemaPromise;
}

function rowToMessage(row: Record<string, unknown>): BatchMessage {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    batchId: row.batch_id as string,
    senderId: row.sender_id as string,
    senderRole: row.sender_role as BatchMessageSenderRole,
    senderName: (row.sender_name as string | null) ?? null,
    body: row.body as string,
    kind: row.kind as BatchMessageKind,
    linkUrl: (row.link_url as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

/** Oldest-first feed (most recent `limit` messages). */
export async function listBatchMessages(
  workspaceId: string,
  batchId: string,
  opts?: { limit?: number },
): Promise<BatchMessage[]> {
  await ensureBatchMessagesSchema();
  const limit = Math.min(opts?.limit ?? 100, 200);
  const result = await pool().query(
    `SELECT m.*, u.name AS sender_name
     FROM content.batch_messages m
     LEFT JOIN origin_users u ON u.id = m.sender_id
     WHERE m.workspace_id = $1 AND m.batch_id = $2
     ORDER BY m.created_at DESC
     LIMIT $3`,
    [workspaceId, batchId, limit],
  );
  return result.rows.map(rowToMessage).reverse();
}

export async function createBatchMessage(input: {
  workspaceId: string;
  batchId: string;
  senderId: string;
  senderRole: BatchMessageSenderRole;
  body: string;
  kind?: BatchMessageKind;
  linkUrl?: string | null;
}): Promise<BatchMessage> {
  await ensureBatchMessagesSchema();
  const id = createPrefixedId("bmsg");
  const result = await pool().query(
    `INSERT INTO content.batch_messages
       (id, workspace_id, batch_id, sender_id, sender_role, body, kind, link_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.batchId,
      input.senderId,
      input.senderRole,
      input.body.trim(),
      input.kind ?? "text",
      input.linkUrl ?? null,
    ],
  );
  // Re-read with the sender name for a consistent shape.
  const row = result.rows[0] as Record<string, unknown>;
  return rowToMessage(row);
}

/**
 * Resolve the workspace a student can post/read in for a given batch — returns
 * the workspaceId only if the student is an ACTIVE member of that batch. The
 * tenancy guard for all student-side batch-hub access.
 */
export async function getStudentBatchContext(
  batchId: string,
  studentId: string,
): Promise<{ workspaceId: string; batchName: string; subject: string | null } | null> {
  const result = await pool().query(
    `SELECT b.workspace_id, b.name, b.subject
     FROM app.batch_members m
     INNER JOIN app.batches b ON b.id = m.batch_id
     WHERE m.batch_id = $1 AND m.student_id = $2 AND m.status = 'active'
     LIMIT 1`,
    [batchId, studentId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    workspaceId: row.workspace_id as string,
    batchName: row.name as string,
    subject: (row.subject as string | null) ?? null,
  };
}
