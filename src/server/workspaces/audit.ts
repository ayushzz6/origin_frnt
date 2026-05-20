import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

import { createAuditEventId } from "./ids";
import { ensureWorkspaceSchema } from "./schema";
import type { AuditEventInput } from "./types";

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  await ensureWorkspaceSchema();
  const p = getUserPostgresPool();
  if (!p) return;
  await p.query(
    `INSERT INTO app.audit_events (
       id, actor_user_id, workspace_id, entity_type, entity_id, action,
       before, after, request_id, ip_hash
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)`,
    [
      createAuditEventId(),
      input.actorUserId,
      input.workspaceId,
      input.entityType,
      input.entityId,
      input.action,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
      input.requestId ?? null,
      input.ipHash ?? null,
    ],
  );
}
