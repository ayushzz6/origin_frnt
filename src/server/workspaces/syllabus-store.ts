/**
 * Batch Syllabus tree store — teacher-authored chapters/topics with progress
 * DERIVED from real student topic mastery (analytics.batch_topic_snapshots),
 * plus an optional per-topic `manualStatus` override. No cross-DB join: the
 * snapshot accuracy is read via the workspace analytics store (same USER DB).
 */

import { getBatchTopicSnapshots } from "./analytics-store";
import { createPrefixedId } from "./ids";
import { ensureSyllabusSchema } from "./syllabus-schema";
import { getUserPostgresPool } from "@/server/user-postgres";

export type SyllabusStatus = "mastered" | "in_progress" | "unstarted";
export type SyllabusNodeKind = "chapter" | "topic";

export type SyllabusTopic = {
  id: string;
  title: string;
  sortOrder: number;
  manualStatus: SyllabusStatus | null;
  /** Derived (manual override wins, else from snapshot accuracy). */
  status: SyllabusStatus;
  accuracy: number | null;
};

export type SyllabusChapter = {
  id: string;
  title: string;
  subject: string | null;
  sortOrder: number;
  topics: SyllabusTopic[];
};

export type SyllabusTree = {
  subject: string;
  chapters: SyllabusChapter[];
  progress: { percent: number; mastered: number; inProgress: number; unstarted: number; total: number };
};

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function deriveStatus(manual: SyllabusStatus | null, accuracy: number | null): SyllabusStatus {
  if (manual) return manual;
  if (accuracy === null) return "unstarted";
  if (accuracy >= 75) return "mastered";
  if (accuracy > 0) return "in_progress";
  return "unstarted";
}

type NodeRow = {
  id: string;
  parent_id: string | null;
  kind: SyllabusNodeKind;
  title: string;
  subject: string | null;
  sort_order: number;
  manual_status: SyllabusStatus | null;
};

export async function getSyllabusTree(workspaceId: string, batchId: string, batchSubject?: string | null): Promise<SyllabusTree> {
  await ensureSyllabusSchema();
  const [nodesResult, snapshots] = await Promise.all([
    pool().query<NodeRow>(
      `SELECT id, parent_id, kind, title, subject, sort_order, manual_status
       FROM content.syllabus_nodes
       WHERE workspace_id = $1 AND batch_id = $2
       ORDER BY sort_order ASC, created_at ASC`,
      [workspaceId, batchId],
    ),
    getBatchTopicSnapshots(workspaceId, batchId, { limit: 200 }).catch(() => []),
  ]);

  // Most-recent accuracy per topic name (case-insensitive). Snapshots are
  // returned newest-first, so the first seen wins.
  const accuracyByTopic = new Map<string, number>();
  for (const snap of snapshots) {
    const key = (snap.topic ?? "").trim().toLowerCase();
    if (key && !accuracyByTopic.has(key)) accuracyByTopic.set(key, snap.accuracy);
  }

  const rows = nodesResult.rows;
  const chapters: SyllabusChapter[] = rows
    .filter((r) => r.kind === "chapter")
    .map((r) => ({ id: r.id, title: r.title, subject: r.subject, sortOrder: r.sort_order, topics: [] }));
  const chapterById = new Map(chapters.map((c) => [c.id, c]));

  let mastered = 0;
  let inProgress = 0;
  let unstarted = 0;
  for (const r of rows) {
    if (r.kind !== "topic" || !r.parent_id) continue;
    const chapter = chapterById.get(r.parent_id);
    if (!chapter) continue;
    const accuracy = accuracyByTopic.get(r.title.trim().toLowerCase()) ?? null;
    const status = deriveStatus(r.manual_status, accuracy);
    if (status === "mastered") mastered += 1;
    else if (status === "in_progress") inProgress += 1;
    else unstarted += 1;
    chapter.topics.push({
      id: r.id,
      title: r.title,
      sortOrder: r.sort_order,
      manualStatus: r.manual_status,
      status,
      accuracy,
    });
  }

  const total = mastered + inProgress + unstarted;
  const percent = total ? Math.round(((mastered + inProgress * 0.5) / total) * 100) : 0;

  return {
    subject: chapters[0]?.subject || batchSubject || "General",
    chapters,
    progress: { percent, mastered, inProgress, unstarted, total },
  };
}

export async function createSyllabusNode(input: {
  workspaceId: string;
  batchId: string;
  parentId?: string | null;
  kind: SyllabusNodeKind;
  title: string;
  subject?: string | null;
  createdBy: string;
}): Promise<{ id: string }> {
  await ensureSyllabusSchema();
  const id = createPrefixedId("syl");
  // Append after existing siblings.
  const orderResult = await pool().query<{ next: number }>(
    `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next
     FROM content.syllabus_nodes
     WHERE workspace_id = $1 AND batch_id = $2 AND parent_id IS NOT DISTINCT FROM $3`,
    [input.workspaceId, input.batchId, input.parentId ?? null],
  );
  await pool().query(
    `INSERT INTO content.syllabus_nodes
       (id, workspace_id, batch_id, parent_id, kind, title, subject, sort_order, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      input.workspaceId,
      input.batchId,
      input.parentId ?? null,
      input.kind,
      input.title.trim(),
      input.subject ?? null,
      orderResult.rows[0]?.next ?? 0,
      input.createdBy,
    ],
  );
  return { id };
}

export async function updateSyllabusNode(
  workspaceId: string,
  nodeId: string,
  patch: { title?: string; manualStatus?: SyllabusStatus | null; sortOrder?: number },
): Promise<boolean> {
  await ensureSyllabusSchema();
  const fields: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  let i = 1;
  if (patch.title !== undefined) { fields.push(`title = $${i++}`); params.push(patch.title.trim()); }
  if (patch.manualStatus !== undefined) { fields.push(`manual_status = $${i++}`); params.push(patch.manualStatus); }
  if (patch.sortOrder !== undefined) { fields.push(`sort_order = $${i++}`); params.push(patch.sortOrder); }
  params.push(nodeId, workspaceId);
  const result = await pool().query(
    `UPDATE content.syllabus_nodes SET ${fields.join(", ")}
     WHERE id = $${i++} AND workspace_id = $${i}`,
    params,
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteSyllabusNode(workspaceId: string, nodeId: string): Promise<boolean> {
  await ensureSyllabusSchema();
  // Children cascade via the self-referential FK ON DELETE CASCADE.
  const result = await pool().query(
    `DELETE FROM content.syllabus_nodes WHERE id = $1 AND workspace_id = $2`,
    [nodeId, workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}
