/**
 * Study materials service (Phase 7).
 * Wraps the store with business rules and audit logging.
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "./audit";
import {
  addStudyMaterialAsset,
  assignStudyMaterial,
  archiveStudyMaterial,
  createStudyMaterial,
  deleteStudyMaterial,
  getMaterialsForBatch,
  getMaterialsForStudent,
  getStudyMaterial,
  listMaterialAssignments,
  listMaterialAssets,
  listStudyMaterials,
  publishStudyMaterial,
  removeStudyMaterialAsset,
  revokeMaterialAssignment,
  updateStudyMaterial,
  type CreateStudyMaterialInput,
  type UpdateStudyMaterialInput,
} from "./study-materials-store";
import type {
  StudyMaterial,
  StudyMaterialAsset,
  StudyMaterialAssignment,
  StudyMaterialAssignmentTarget,
  StudyMaterialWithAssets,
} from "./types";

export async function createMaterial(input: {
  workspaceId: string;
  title: string;
  description?: string | null;
  materialType?: CreateStudyMaterialInput["materialType"];
  subject?: string | null;
  topic?: string | null;
  classLevel?: string | null;
  createdBy: string;
  requestId?: string | null;
}): Promise<StudyMaterial> {
  if (!input.title.trim()) {
    throw new Error("Material title is required.");
  }
  const material = await createStudyMaterial({
    workspaceId: input.workspaceId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    materialType: input.materialType,
    subject: input.subject?.trim() || null,
    topic: input.topic?.trim() || null,
    classLevel: input.classLevel?.trim() || null,
    createdBy: input.createdBy,
  });
  await recordAuditEvent({
    actorUserId: input.createdBy,
    workspaceId: input.workspaceId,
    entityType: "study_material",
    entityId: material.id,
    action: "study_material.created",
    after: material,
    requestId: input.requestId,
  });
  return material;
}

export async function patchMaterial(input: {
  workspaceId: string;
  materialId: string;
  patch: UpdateStudyMaterialInput;
  actorUserId: string;
  requestId?: string | null;
}): Promise<StudyMaterial> {
  const before = await getStudyMaterial(input.workspaceId, input.materialId);
  if (!before) {
    throw new AuthzError(403, "Study material not found.");
  }
  const updated = await updateStudyMaterial(input.workspaceId, input.materialId, input.patch);
  if (!updated) {
    throw new AuthzError(403, "Study material update failed.");
  }
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "study_material",
    entityId: input.materialId,
    action: "study_material.updated",
    before,
    after: updated,
    requestId: input.requestId,
  });
  return updated;
}

export async function publishMaterial(input: {
  workspaceId: string;
  materialId: string;
  actorUserId: string;
  requestId?: string | null;
}): Promise<StudyMaterial> {
  const before = await getStudyMaterial(input.workspaceId, input.materialId);
  if (!before) {
    throw new AuthzError(403, "Study material not found.");
  }
  const assets = await listMaterialAssets(input.materialId);
  if (assets.length === 0) {
    throw new Error("Cannot publish material without assets. Upload at least one file.");
  }
  const updated = await publishStudyMaterial(input.workspaceId, input.materialId);
  if (!updated) {
    throw new AuthzError(403, "Material could not be published. It may already be published or archived.");
  }
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "study_material",
    entityId: input.materialId,
    action: "study_material.published",
    before,
    after: updated,
    requestId: input.requestId,
  });
  return updated;
}

export async function archiveMaterial(input: {
  workspaceId: string;
  materialId: string;
  actorUserId: string;
  requestId?: string | null;
}): Promise<StudyMaterial> {
  const before = await getStudyMaterial(input.workspaceId, input.materialId);
  if (!before) {
    throw new AuthzError(403, "Study material not found.");
  }
  const updated = await archiveStudyMaterial(input.workspaceId, input.materialId);
  if (!updated) {
    throw new AuthzError(403, "Material could not be archived. It may not be published.");
  }
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "study_material",
    entityId: input.materialId,
    action: "study_material.archived",
    before,
    after: updated,
    requestId: input.requestId,
  });
  return updated;
}

export async function removeMaterial(input: {
  workspaceId: string;
  materialId: string;
  actorUserId: string;
  requestId?: string | null;
}): Promise<boolean> {
  const before = await getStudyMaterial(input.workspaceId, input.materialId);
  if (!before) {
    throw new AuthzError(403, "Study material not found.");
  }
  const deleted = await deleteStudyMaterial(input.workspaceId, input.materialId);
  if (deleted) {
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: "study_material",
      entityId: input.materialId,
      action: "study_material.deleted",
      before,
      requestId: input.requestId,
    });
  }
  return deleted;
}

// ─── Asset operations ─────────────────────────────────────────────────────────

export async function uploadMaterialAsset(input: {
  workspaceId: string;
  materialId: string;
  r2ObjectKey: string;
  r2Bucket: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  displayName?: string | null;
  sortOrder?: number;
  actorUserId: string;
  requestId?: string | null;
}): Promise<StudyMaterialAsset> {
  const material = await getStudyMaterial(input.workspaceId, input.materialId);
  if (!material) {
    throw new AuthzError(403, "Study material not found.");
  }
  if (material.status === "archived") {
    throw new Error("Cannot add assets to an archived material.");
  }
  const asset = await addStudyMaterialAsset({
    materialId: input.materialId,
    r2ObjectKey: input.r2ObjectKey,
    r2Bucket: input.r2Bucket,
    publicUrl: input.publicUrl,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    sha256: input.sha256,
    displayName: input.displayName,
    sortOrder: input.sortOrder,
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "study_material_asset",
    entityId: asset.id,
    action: "study_material_asset.uploaded",
    after: { ...asset },
    requestId: input.requestId,
  });
  return asset;
}

export async function removeAsset(input: {
  workspaceId: string;
  materialId: string;
  assetId: string;
  actorUserId: string;
  requestId?: string | null;
}): Promise<boolean> {
  const deleted = await removeStudyMaterialAsset(input.materialId, input.assetId);
  if (deleted) {
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: "study_material_asset",
      entityId: input.assetId,
      action: "study_material_asset.removed",
      requestId: input.requestId,
    });
  }
  return deleted;
}

// ─── Assignment operations ────────────────────────────────────────────────────

export async function assignMaterialToTarget(input: {
  workspaceId: string;
  materialId: string;
  targetType: StudyMaterialAssignmentTarget;
  targetId: string;
  assignedBy: string;
  requestId?: string | null;
}): Promise<StudyMaterialAssignment> {
  const material = await getStudyMaterial(input.workspaceId, input.materialId);
  if (!material) {
    throw new AuthzError(403, "Study material not found.");
  }
  if (material.status !== "published") {
    throw new Error("Only published materials can be assigned.");
  }
  const assignment = await assignStudyMaterial({
    materialId: input.materialId,
    workspaceId: input.workspaceId,
    targetType: input.targetType,
    targetId: input.targetId,
    assignedBy: input.assignedBy,
  });
  await recordAuditEvent({
    actorUserId: input.assignedBy,
    workspaceId: input.workspaceId,
    entityType: "study_material_assignment",
    entityId: assignment.id,
    action: "study_material.assigned",
    after: { ...assignment, materialTitle: material.title },
    requestId: input.requestId,
  });
  return assignment;
}

export async function revokeAssignment(input: {
  workspaceId: string;
  materialId: string;
  targetType: StudyMaterialAssignmentTarget;
  targetId: string;
  actorUserId: string;
  requestId?: string | null;
}): Promise<boolean> {
  const revoked = await revokeMaterialAssignment(input.materialId, input.targetType, input.targetId);
  if (revoked) {
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: "study_material_assignment",
      entityId: `${input.materialId}:${input.targetType}:${input.targetId}`,
      action: "study_material.unassigned",
      requestId: input.requestId,
    });
  }
  return revoked;
}

// ─── Read operations ──────────────────────────────────────────────────────────

export async function listMaterials(
  workspaceId: string,
  filter?: { status?: "all" | "draft" | "published" | "archived"; subject?: string },
): Promise<StudyMaterialWithAssets[]> {
  return listStudyMaterials(workspaceId, filter);
}

export async function getMaterialWithAssets(
  workspaceId: string,
  materialId: string,
): Promise<(StudyMaterialWithAssets) | null> {
  const material = await getStudyMaterial(workspaceId, materialId);
  if (!material) return null;
  const assets = await listMaterialAssets(materialId);
  return { ...material, assets, assetCount: assets.length };
}

export async function getAssignmentsForMaterial(materialId: string): Promise<StudyMaterialAssignment[]> {
  return listMaterialAssignments(materialId);
}

export async function getMaterialsVisibleToBatch(
  workspaceId: string,
  batchId: string,
): Promise<StudyMaterialWithAssets[]> {
  return getMaterialsForBatch(workspaceId, batchId);
}

export async function getMaterialsVisibleToStudent(
  workspaceId: string,
  studentId: string,
): Promise<StudyMaterialWithAssets[]> {
  return getMaterialsForStudent(workspaceId, studentId);
}
