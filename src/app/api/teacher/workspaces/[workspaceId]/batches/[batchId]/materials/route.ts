import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { isAllowedStudyMaterialMimeType, uploadStudyMaterialToR2 } from "@/server/media-storage";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  assignMaterialToTarget,
  createMaterial,
  getMaterialsVisibleToBatch,
  publishMaterial,
  uploadMaterialAsset,
} from "@/server/workspaces/study-materials-service";
import type { StudyMaterialType } from "@/server/workspaces/types";

import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";

type Context = {
  params: Promise<{ workspaceId: string; batchId: string }>;
};

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

function fileMaterialType(mimeType: string): StudyMaterialType {
  const m = mimeType.toLowerCase();
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("image/")) return "image";
  if (m.includes("word") || m === "application/msword") return "docx";
  return "other";
}

export async function GET(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("studyMaterials");
    const { workspaceId, batchId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const materials = await getMaterialsVisibleToBatch(workspaceId, batchId);
    return teacherJson({ materials });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    requireFeatureEnabled("studyMaterials");
    const { workspaceId, batchId } = await context.params;
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const userId = ctx.auth.userId;
    const contentType = request.headers.get("content-type") ?? "";

    // ── Link / video share (JSON) ───────────────────────────────────────────
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        linkUrl?: string;
        title?: string;
        description?: string | null;
      };
      const linkUrl = (body.linkUrl ?? "").trim();
      if (!/^https?:\/\//i.test(linkUrl)) {
        return teacherJson({ detail: "Enter a valid http(s) link." }, { status: 400 });
      }
      const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(linkUrl);
      const title = (body.title ?? "").trim() || (isYouTube ? "YouTube video" : linkUrl);
      const materialType: StudyMaterialType = isYouTube ? "video" : "link";

      const material = await createMaterial({
        workspaceId,
        title,
        description: body.description ?? null,
        materialType,
        subject: null,
        createdBy: userId,
        requestId: requestIdOf(request),
      });
      await uploadMaterialAsset({
        workspaceId,
        materialId: material.id,
        r2ObjectKey: "external",
        r2Bucket: "external",
        publicUrl: linkUrl,
        mimeType: "text/uri-list",
        sizeBytes: 0,
        sha256: "external",
        displayName: title,
        actorUserId: userId,
        requestId: requestIdOf(request),
      });
      await publishMaterial({ workspaceId, materialId: material.id, actorUserId: userId });
      await assignMaterialToTarget({
        workspaceId,
        materialId: material.id,
        targetType: "batch",
        targetId: batchId,
        assignedBy: userId,
        requestId: requestIdOf(request),
      });
      return teacherJson({ material }, { status: 201 });
    }

    // ── File upload (multipart → Cloudflare R2; metadata → Postgres) ─────────
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return teacherJson({ detail: "No file provided." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return teacherJson({ detail: "File exceeds the 20MB limit." }, { status: 400 });
    }
    const mimeType = file.type || "application/octet-stream";
    if (!isAllowedStudyMaterialMimeType(mimeType)) {
      return teacherJson({ detail: "Unsupported file type. Use PDF, DOCX, PPTX, image, or text." }, { status: 400 });
    }
    const title = ((form.get("title") as string | null) ?? file.name).trim() || file.name;
    const description = (form.get("description") as string | null) ?? null;
    const body = Buffer.from(await file.arrayBuffer());

    const material = await createMaterial({
      workspaceId,
      title,
      description,
      materialType: fileMaterialType(mimeType),
      createdBy: userId,
      requestId: requestIdOf(request),
    });
    const uploaded = await uploadStudyMaterialToR2({
      workspaceId,
      batchId,
      fileName: file.name,
      mimeType,
      body,
    });
    await uploadMaterialAsset({
      workspaceId,
      materialId: material.id,
      r2ObjectKey: uploaded.objectKey,
      r2Bucket: uploaded.bucket,
      publicUrl: uploaded.publicUrl,
      mimeType,
      sizeBytes: uploaded.sizeBytes,
      sha256: uploaded.sha256,
      displayName: file.name,
      actorUserId: userId,
      requestId: requestIdOf(request),
    });
    await publishMaterial({ workspaceId, materialId: material.id, actorUserId: userId });
    await assignMaterialToTarget({
      workspaceId,
      materialId: material.id,
      targetType: "batch",
      targetId: batchId,
      assignedBy: userId,
      requestId: requestIdOf(request),
    });
    return teacherJson({ material }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
