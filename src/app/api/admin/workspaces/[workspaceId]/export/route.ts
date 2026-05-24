/**
 * GET /api/admin/workspaces/[workspaceId]/export — full workspace dump.
 *
 * Streams a single JSON document containing the workspace, its members,
 * batches, enrollments, questions, tests, offerings, and audit events.
 * Admin-only. The response is sent via a ReadableStream so very large
 * workspaces don't OOM the function — each section is yielded as a
 * top-level key with its rows.
 *
 * Writes one app.audit_events row per call so admins can reconstruct
 * who pulled the dump (entity_type "workspace_export").
 */

import type { NextRequest } from "next/server";

import { requireRole } from "@/server/authz";
import { listAuditEventsService } from "@/server/workspaces/admin-service";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { listBatches, listBatchMembers } from "@/server/workspaces/batches";
import { listEnrollments } from "@/server/workspaces/enrollments";
import { listOfferings } from "@/server/workspaces/marketplace-store";
import { listQuestions } from "@/server/workspaces/questions";
import { getWorkspaceById, listCodesForWorkspace, listMembers } from "@/server/workspaces/store";
import { listTeacherTests } from "@/server/workspaces/tests-service";

import {
  handleTeacherError,
  requestIdOf,
  teacherJson,
} from "@/app/api/teacher/_utils";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const auth = await requireRole(request, ["admin"]);
    const { workspaceId } = await context.params;
    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace) {
      return teacherJson({ detail: "Workspace not found." }, { status: 404 });
    }

    await recordAuditEvent({
      actorUserId: auth.userId,
      workspaceId,
      entityType: "workspace_export",
      entityId: workspaceId,
      action: "workspace_export.requested",
      requestId: requestIdOf(request),
    });

    const stream = streamExport(workspaceId);
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="workspace-${workspaceId}-export.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleTeacherError(error);
  }
}

function streamExport(workspaceId: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const writeRaw = (s: string) => controller.enqueue(encoder.encode(s));
      const writeSection = async (
        key: string,
        loader: () => Promise<unknown>,
        prefix: string,
      ) => {
        try {
          const value = await loader();
          writeRaw(`${prefix}${JSON.stringify(key)}:${JSON.stringify(value ?? null)}`);
        } catch (err) {
          writeRaw(
            `${prefix}${JSON.stringify(key)}:${JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            })}`,
          );
        }
      };

      try {
        writeRaw("{");
        writeRaw(`"exportVersion":1,"workspaceId":${JSON.stringify(workspaceId)},"exportedAt":${JSON.stringify(new Date().toISOString())}`);
        await writeSection("workspace", () => getWorkspaceById(workspaceId), ",");
        await writeSection("members", () => listMembers(workspaceId), ",");
        await writeSection("codes", () => listCodesForWorkspace(workspaceId), ",");
        await writeSection("batches", async () => {
          const batches = await listBatches(workspaceId);
          const withMembers = await Promise.all(
            batches.map(async (b) => ({
              ...b,
              members: await listBatchMembers(workspaceId, b.id),
            })),
          );
          return withMembers;
        }, ",");
        await writeSection("enrollments", () => listEnrollments(workspaceId), ",");
        await writeSection("questions", () => listQuestions(workspaceId), ",");
        await writeSection("tests", () => listTeacherTests(workspaceId), ",");
        await writeSection("offerings", () => listOfferings(workspaceId), ",");
        await writeSection(
          "auditEvents",
          () => listAuditEventsService({ workspaceId, limit: 10_000 }),
          ",",
        );
        writeRaw("}");
      } catch (err) {
        writeRaw(
          `,"streamError":${JSON.stringify(
            err instanceof Error ? err.message : String(err),
          )}}`,
        );
      } finally {
        controller.close();
      }
    },
  });
}
