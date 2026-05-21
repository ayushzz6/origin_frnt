/**
 * OGCode publishing service (Phase 9).
 * Wraps the store with business rules and audit logging.
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "./audit";
import {
  approvePublication,
  createOgcodePublication,
  createRepublishVersion,
  getOgcodePublication,
  getPublicationByOgcodeQuestion,
  listOgcodePublications,
  listPendingReviewPublications,
  publishPublication,
  rejectPublication,
  supersedePublication,
  validatePublicationRequirements,
} from "./ogcode-publishing-store";
import type {
  OgcodePublication,
  OgcodePublicationStatus,
  OgcodePublicationWithQuestion,
} from "./types";

export async function submitForPublication(input: {
  workspaceId: string;
  ogcodeQuestionId: string;
  questionBagQuestionId?: string | null;
  submittedBy: string;
  hintProvided: boolean;
  fullSolutionProvided: boolean;
  requestId?: string | null;
}): Promise<OgcodePublication> {
  const validation = validatePublicationRequirements({
    ogcodeQuestionId: input.ogcodeQuestionId,
    hintProvided: input.hintProvided,
    fullSolutionProvided: input.fullSolutionProvided,
  });
  if (!validation.valid) {
    throw new Error(
      `Cannot submit for publication. Missing requirements: ${validation.missingRequirements.join(", ")}.`,
    );
  }

  const existing = await getPublicationByOgcodeQuestion(input.ogcodeQuestionId);
  if (existing && existing.status === "published") {
    throw new Error("This question already has a published version in OGCode.");
  }

  const publication = await createOgcodePublication({
    workspaceId: input.workspaceId,
    ogcodeQuestionId: input.ogcodeQuestionId,
    questionBagQuestionId: input.questionBagQuestionId,
    submittedBy: input.submittedBy,
    hintProvided: input.hintProvided,
    fullSolutionProvided: input.fullSolutionProvided,
  });

  await recordAuditEvent({
    actorUserId: input.submittedBy,
    workspaceId: input.workspaceId,
    entityType: "ogcode_publication",
    entityId: publication.id,
    action: "ogcode_publication.submitted",
    after: publication,
    requestId: input.requestId,
  });

  return publication;
}

export async function republishQuestion(input: {
  workspaceId: string;
  originalPublicationId: string;
  ogcodeQuestionId: string;
  questionBagQuestionId?: string | null;
  submittedBy: string;
  hintProvided: boolean;
  fullSolutionProvided: boolean;
  requestId?: string | null;
}): Promise<{ newPublication: OgcodePublication; superseded: OgcodePublication | null }> {
  const validation = validatePublicationRequirements({
    ogcodeQuestionId: input.ogcodeQuestionId,
    hintProvided: input.hintProvided,
    fullSolutionProvided: input.fullSolutionProvided,
  });
  if (!validation.valid) {
    throw new Error(
      `Cannot republish. Missing requirements: ${validation.missingRequirements.join(", ")}.`,
    );
  }

  const original = await getOgcodePublication(input.workspaceId, input.originalPublicationId);
  if (!original) {
    throw new AuthzError(403, "Original publication not found.");
  }
  if (original.status !== "published") {
    throw new Error("Can only republish a published question.");
  }

  const result = await createRepublishVersion({
    workspaceId: input.workspaceId,
    originalPublicationId: input.originalPublicationId,
    ogcodeQuestionId: input.ogcodeQuestionId,
    questionBagQuestionId: input.questionBagQuestionId,
    submittedBy: input.submittedBy,
    hintProvided: input.hintProvided,
    fullSolutionProvided: input.fullSolutionProvided,
  });

  await recordAuditEvent({
    actorUserId: input.submittedBy,
    workspaceId: input.workspaceId,
    entityType: "ogcode_publication",
    entityId: result.newPublication.id,
    action: "ogcode_publication.republished",
    after: { newPublication: result.newPublication.id, superseded: result.superseded?.id },
    requestId: input.requestId,
  });

  return result;
}

export async function reviewPublication(input: {
  workspaceId: string;
  publicationId: string;
  action: "approve" | "reject" | "publish";
  adminUserId: string;
  notes?: string | null;
  requestId?: string | null;
}): Promise<OgcodePublication> {
  const before = await getOgcodePublication(input.workspaceId, input.publicationId);
  if (!before) {
    throw new AuthzError(403, "Publication not found.");
  }

  let result: OgcodePublication | null;
  let actionLabel: string;

  switch (input.action) {
    case "approve":
      result = await approvePublication({
        workspaceId: input.workspaceId,
        publicationId: input.publicationId,
        adminUserId: input.adminUserId,
        notes: input.notes,
      });
      actionLabel = "ogcode_publication.approved";
      break;
    case "reject":
      result = await rejectPublication({
        workspaceId: input.workspaceId,
        publicationId: input.publicationId,
        adminUserId: input.adminUserId,
        notes: input.notes,
      });
      actionLabel = "ogcode_publication.rejected";
      break;
    case "publish":
      result = await publishPublication({
        workspaceId: input.workspaceId,
        publicationId: input.publicationId,
        adminUserId: input.adminUserId,
      });
      actionLabel = "ogcode_publication.published";
      break;
    default:
      throw new Error("Invalid review action.");
  }

  if (!result) {
    throw new AuthzError(403, "Publication could not be reviewed. It may not be in pending/approved status.");
  }

  await recordAuditEvent({
    actorUserId: input.adminUserId,
    workspaceId: input.workspaceId,
    entityType: "ogcode_publication",
    entityId: input.publicationId,
    action: actionLabel,
    before,
    after: result,
    requestId: input.requestId,
  });

  return result;
}

export async function supersedePublicationById(input: {
  workspaceId: string;
  publicationId: string;
  newPublicationId: string;
  actorUserId: string;
  requestId?: string | null;
}): Promise<OgcodePublication | null> {
  const before = await getOgcodePublication(input.workspaceId, input.publicationId);
  if (!before) {
    throw new AuthzError(403, "Publication not found.");
  }

  const superseded = await supersedePublication({
    workspaceId: input.workspaceId,
    originalPublicationId: input.publicationId,
    newPublicationId: input.newPublicationId,
  });

  if (superseded) {
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: "ogcode_publication",
      entityId: input.publicationId,
      action: "ogcode_publication.superseded",
      before,
      after: superseded,
      requestId: input.requestId,
    });
  }

  return superseded;
}

// ─── Read operations ──────────────────────────────────────────────────────────

export async function listPublications(
  workspaceId: string,
  filter?: { status?: OgcodePublicationStatus | "all"; submittedBy?: string },
): Promise<OgcodePublication[]> {
  return listOgcodePublications(workspaceId, filter);
}

export async function getPendingReviewQueue(
  limit?: number,
): Promise<OgcodePublicationWithQuestion[]> {
  return listPendingReviewPublications(limit);
}

export async function getPublicationDetail(
  workspaceId: string,
  publicationId: string,
): Promise<OgcodePublication | null> {
  return getOgcodePublication(workspaceId, publicationId);
}

export async function getPublishedVersionForQuestion(
  ogcodeQuestionId: string,
): Promise<OgcodePublication | null> {
  return getPublicationByOgcodeQuestion(ogcodeQuestionId);
}

export function checkPublicationRequirements(input: {
  hintProvided: boolean;
  fullSolutionProvided: boolean;
}): { valid: boolean; missingRequirements: string[] } {
  return validatePublicationRequirements({
    ogcodeQuestionId: "",
    hintProvided: input.hintProvided,
    fullSolutionProvided: input.fullSolutionProvided,
  });
}
