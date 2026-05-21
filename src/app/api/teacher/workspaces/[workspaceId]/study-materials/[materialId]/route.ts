import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  archiveMaterial,
  assignMaterialToTarget,
  getAssignmentsForMaterial,
  getMaterialWithAssets,
  patchMaterial,
  publishMaterial,
  removeAsset,
  removeMaterial,
  revokeAssignment,
  uploadMaterialAsset,
} from "@/server/workspaces/study-materials-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../../_utils";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  materialType: z.enum(["pdf", "docx", "image", "video", "link", "other"]).optional(),
  subject: z.string().max(80).nullable().optional(),
  topic: z.string().max(120).nullable().optional(),
  classLevel: z.string().max(40).nullable().optional(),
});

const assetSchema = z.object({
  r2ObjectKey: z.string(),
  r2Bucket: z.string(),
  publicUrl: z.string().url(),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  sha256: z.string(),
  displayName: z.string().max(200).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const assignmentSchema = z.object({
  targetType: z.enum(["batch", "student", "workspace"]),
  targetId: z.string(),
});

export async function GET(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; materialId: string }> },
) {
  try {
    requireFeatureEnabled("studyMaterials");
    const { workspaceId, materialId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const material = await getMaterialWithAssets(workspaceId, materialId);
    if (!material) {
      return teacherJson({ detail: "Study material not found." }, { status: 404 });
    }
    return teacherJson({ material });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; materialId: string }> },
) {
  try {
    requireFeatureEnabled("studyMaterials");
    const { workspaceId, materialId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner",
      "admin",
      "teacher",
      "content_manager",
    ]);
    const body = await parseJsonBody(request);
    const parsed = updateSchema.parse(body);
    const updated = await patchMaterial({
      workspaceId,
      materialId,
      patch: parsed,
      actorUserId: ctx.auth.userId,
      requestId: requestIdOf(request),
    });
    return teacherJson({ material: updated });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; materialId: string }> },
) {
  try {
    requireFeatureEnabled("studyMaterials");
    const { workspaceId, materialId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const deleted = await removeMaterial({
      workspaceId,
      materialId,
      actorUserId: ctx.auth.userId,
      requestId: requestIdOf(request),
    });
    if (!deleted) {
      return teacherJson({ detail: "Study material not found." }, { status: 404 });
    }
    return teacherJson({ success: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}

// ─── Sub-actions via query param ──────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; materialId: string }> },
) {
  try {
    requireFeatureEnabled("studyMaterials");
    const { workspaceId, materialId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner",
      "admin",
      "teacher",
      "content_manager",
    ]);
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const body = await parseJsonBody(request);

    switch (action) {
      case "publish": {
        const published = await publishMaterial({
          workspaceId,
          materialId,
          actorUserId: ctx.auth.userId,
          requestId: requestIdOf(request),
        });
        return teacherJson({ material: published });
      }
      case "archive": {
        const archived = await archiveMaterial({
          workspaceId,
          materialId,
          actorUserId: ctx.auth.userId,
          requestId: requestIdOf(request),
        });
        return teacherJson({ material: archived });
      }
      case "upload-asset": {
        const parsed = assetSchema.parse(body);
        const asset = await uploadMaterialAsset({
          workspaceId,
          materialId,
          ...parsed,
          actorUserId: ctx.auth.userId,
          requestId: requestIdOf(request),
        });
        return teacherJson({ asset }, { status: 201 });
      }
      case "assign": {
        const parsed = assignmentSchema.parse(body);
        const assignment = await assignMaterialToTarget({
          workspaceId,
          materialId,
          targetType: parsed.targetType,
          targetId: parsed.targetId,
          assignedBy: ctx.auth.userId,
          requestId: requestIdOf(request),
        });
        return teacherJson({ assignment }, { status: 201 });
      }
      case "revoke-assignment": {
        const parsed = assignmentSchema.parse(body);
        const revoked = await revokeAssignment({
          workspaceId,
          materialId,
          targetType: parsed.targetType,
          targetId: parsed.targetId,
          actorUserId: ctx.auth.userId,
          requestId: requestIdOf(request),
        });
        return teacherJson({ success: revoked });
      }
      case "assignments": {
        const assignments = await getAssignmentsForMaterial(materialId);
        return teacherJson({ assignments });
      }
      default:
        return teacherJson({ detail: "Invalid action. Use: publish, archive, upload-asset, assign, revoke-assignment, assignments." }, { status: 400 });
    }
  } catch (error) {
    return handleTeacherError(error);
  }
}
