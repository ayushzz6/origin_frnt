import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { createMaterial, listMaterials } from "@/server/workspaces/study-materials-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../_utils";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  materialType: z.enum(["pdf", "docx", "image", "video", "link", "other"]).optional(),
  subject: z.string().max(80).nullable().optional(),
  topic: z.string().max(120).nullable().optional(),
  classLevel: z.string().max(40).nullable().optional(),
});

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("studyMaterials");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const subject = url.searchParams.get("subject");
    const allowed = ["draft", "published", "archived", "all"] as const;
    const status = rawStatus && allowed.includes(rawStatus as (typeof allowed)[number])
      ? (rawStatus as (typeof allowed)[number])
      : undefined;
    const materials = await listMaterials(workspaceId, {
      status: status === "all" ? "all" : status,
      subject: subject ?? undefined,
    });
    return teacherJson({ materials });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("studyMaterials");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner",
      "admin",
      "teacher",
      "content_manager",
    ]);
    const body = await parseJsonBody(request);
    const parsed = createSchema.parse(body);
    const material = await createMaterial({
      workspaceId,
      title: parsed.title,
      description: parsed.description,
      materialType: parsed.materialType,
      subject: parsed.subject,
      topic: parsed.topic,
      classLevel: parsed.classLevel,
      createdBy: ctx.auth.userId,
      requestId: requestIdOf(request),
    });
    await recordAuditEvent({
      actorUserId: ctx.auth.userId,
      workspaceId,
      entityType: "study_material",
      entityId: material.id,
      action: "study_material.created",
      after: material,
      requestId: requestIdOf(request),
    });
    return teacherJson({ material }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
