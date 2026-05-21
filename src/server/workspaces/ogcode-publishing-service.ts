/**
 * OGCode publishing service (Phase 9).
 * Wraps the store with business rules and audit logging.
 *
 * The publish gate is enforced here, server-side. We read the actual
 * content.question_versions row instead of trusting caller-supplied
 * booleans — Phase 4 plan states hint + full_solution + answer fields
 * are mandatory for any OGCode publication.
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "./audit";
import {
  approvePublication,
  archiveAsSuperseded,
  createOgcodePublication,
  getOgcodePublication,
  getPublishedPublicationForQuestion,
  listOgcodePublications,
  listSubmittedPublications,
  publishPublication,
  rejectPublication,
  requestChanges,
  submitForReview,
} from "./ogcode-publishing-store";
import { getVersionById } from "./questions";
import type {
  OgcodePublication,
  OgcodePublicationStatus,
  OgcodePublicationWithQuestion,
  QuestionVersion,
} from "./types";

/**
 * Server-enforced publish-readiness check. Reads the actual question
 * version and returns the list of missing fields. A version is publish-
 * ready iff:
 *   - non-empty `hint`
 *   - non-empty `full_solution`
 *   - a complete answer for the question's type (correctOption[s] for
 *     MCQ/MSQ, answerText/answerSpec for numerical/equation/etc.)
 */
export function describeMissingPublishRequirements(version: QuestionVersion): string[] {
  const missing: string[] = [];
  if (!version.hint || !version.hint.trim()) missing.push("hint");
  if (!version.fullSolution || !version.fullSolution.trim()) missing.push("full_solution");

  switch (version.questionType) {
    case "mcq":
      if (version.correctOption == null) missing.push("correct_option");
      break;
    case "msq":
      if (!version.correctOptions || version.correctOptions.length === 0) {
        missing.push("correct_options");
      }
      break;
    case "numerical":
    case "numerical_with_units":
      if ((!version.answerText || !version.answerText.trim()) && !version.answerSpec) {
        missing.push("answer");
      }
      break;
    case "symbolic_expression":
    case "equation":
      if (!version.answerText || !version.answerText.trim()) missing.push("answer");
      break;
    case "matrix_match":
      if (!version.matrixData) missing.push("matrix_data");
      break;
    case "subjective":
      // Subjective requires only the model answer in full_solution; no
      // additional answer field gate.
      break;
  }

  return missing;
}

async function loadVersionOrThrow(versionId: string): Promise<QuestionVersion> {
  const version = await getVersionById(versionId);
  if (!version) {
    throw new AuthzError(404, "Question version not found.");
  }
  return version;
}

export type SubmitForPublicationInput = {
  workspaceId: string;
  questionId: string;
  questionVersionId: string;
  contributorUserId: string;
  attributionName: string;
  attributionLogoAssetId?: string | null;
  requestId?: string | null;
};

export async function submitForPublication(input: SubmitForPublicationInput): Promise<OgcodePublication> {
  // Server-side gate: read the version, not the request body.
  const version = await loadVersionOrThrow(input.questionVersionId);
  if (version.questionId !== input.questionId) {
    throw new AuthzError(400, "Question version does not belong to the supplied question.");
  }
  const missing = describeMissingPublishRequirements(version);
  if (missing.length > 0) {
    throw new AuthzError(
      400,
      `Cannot submit for publication. Missing: ${missing.join(", ")}.`,
    );
  }

  // Refuse re-submitting a question that already has a live publication.
  const live = await getPublishedPublicationForQuestion(input.questionId);
  if (live) {
    throw new AuthzError(
      409,
      "This question already has a published OGCode version. Use republish instead.",
    );
  }

  const publication = await createOgcodePublication({
    questionId: input.questionId,
    questionVersionId: input.questionVersionId,
    contributorWorkspaceId: input.workspaceId,
    contributorUserId: input.contributorUserId,
    attributionName: input.attributionName,
    attributionLogoAssetId: input.attributionLogoAssetId,
    status: "submitted",
  });

  await recordAuditEvent({
    actorUserId: input.contributorUserId,
    workspaceId: input.workspaceId,
    entityType: "ogcode_publication",
    entityId: publication.id,
    action: "ogcode_publication.submitted",
    after: publication,
    requestId: input.requestId,
  });

  return publication;
}

export type RepublishInput = {
  workspaceId: string;
  originalPublicationId: string;
  questionId: string;
  questionVersionId: string;
  contributorUserId: string;
  attributionName: string;
  attributionLogoAssetId?: string | null;
  requestId?: string | null;
};

export async function republishQuestion(
  input: RepublishInput,
): Promise<{ newPublication: OgcodePublication; archived: OgcodePublication | null }> {
  const original = await getOgcodePublication(input.workspaceId, input.originalPublicationId);
  if (!original) {
    throw new AuthzError(404, "Original publication not found.");
  }
  if (original.status !== "published") {
    throw new AuthzError(409, "Can only republish a currently-published version.");
  }

  const version = await loadVersionOrThrow(input.questionVersionId);
  if (version.questionId !== input.questionId) {
    throw new AuthzError(400, "Question version does not belong to the supplied question.");
  }
  const missing = describeMissingPublishRequirements(version);
  if (missing.length > 0) {
    throw new AuthzError(400, `Cannot republish. Missing: ${missing.join(", ")}.`);
  }

  const newPublication = await createOgcodePublication({
    questionId: input.questionId,
    questionVersionId: input.questionVersionId,
    contributorWorkspaceId: input.workspaceId,
    contributorUserId: input.contributorUserId,
    attributionName: input.attributionName,
    attributionLogoAssetId: input.attributionLogoAssetId,
    status: "submitted",
    version: original.version + 1,
  });

  // Don't archive the old one yet — admins still need to approve+publish
  // the new submission. The supersede happens at publish time below.
  await recordAuditEvent({
    actorUserId: input.contributorUserId,
    workspaceId: input.workspaceId,
    entityType: "ogcode_publication",
    entityId: newPublication.id,
    action: "ogcode_publication.republish_submitted",
    after: { newPublication: newPublication.id, originalPublication: original.id },
    requestId: input.requestId,
  });

  return { newPublication, archived: null };
}

export type ReviewAction = "approve" | "request_changes" | "reject" | "publish";

export async function reviewPublication(input: {
  publicationId: string;
  action: ReviewAction;
  reviewerUserId: string;
  notes?: string | null;
  requestId?: string | null;
}): Promise<OgcodePublication> {
  // Reviewer is platform-admin scoped; the publication lookup uses
  // contributor_workspace_id which the admin may not match, so use a
  // workspace-agnostic load via the dedicated admin read.
  let result: OgcodePublication | null = null;
  let auditAction: string;

  switch (input.action) {
    case "approve":
      result = await approvePublication({
        publicationId: input.publicationId,
        reviewerUserId: input.reviewerUserId,
        notes: input.notes,
      });
      auditAction = "ogcode_publication.approved";
      break;
    case "request_changes":
      if (!input.notes || !input.notes.trim()) {
        throw new AuthzError(400, "Moderation notes are required when requesting changes.");
      }
      result = await requestChanges({
        publicationId: input.publicationId,
        reviewerUserId: input.reviewerUserId,
        notes: input.notes,
      });
      auditAction = "ogcode_publication.changes_requested";
      break;
    case "reject":
      result = await rejectPublication({
        publicationId: input.publicationId,
        reviewerUserId: input.reviewerUserId,
        notes: input.notes,
      });
      auditAction = "ogcode_publication.rejected";
      break;
    case "publish":
      result = await publishPublication({
        publicationId: input.publicationId,
        reviewerUserId: input.reviewerUserId,
      });
      auditAction = "ogcode_publication.published";
      // After publishing a republish, archive the previous live row.
      if (result) {
        const prior = await findPriorPublishedForQuestion(result.questionId, result.id);
        if (prior) {
          await archiveAsSuperseded({
            originalPublicationId: prior.id,
            newPublicationId: result.id,
          });
          await recordAuditEvent({
            actorUserId: input.reviewerUserId,
            workspaceId: prior.contributorWorkspaceId ?? "",
            entityType: "ogcode_publication",
            entityId: prior.id,
            action: "ogcode_publication.archived_by_republish",
            before: prior,
            after: { archivedById: result.id },
            requestId: input.requestId,
          });
        }
      }
      break;
    default:
      throw new AuthzError(400, "Invalid review action.");
  }

  if (!result) {
    throw new AuthzError(
      409,
      "Publication could not be transitioned. It may not be in the expected status.",
    );
  }

  await recordAuditEvent({
    actorUserId: input.reviewerUserId,
    workspaceId: result.contributorWorkspaceId ?? "",
    entityType: "ogcode_publication",
    entityId: input.publicationId,
    action: auditAction,
    after: result,
    requestId: input.requestId,
  });

  return result;
}

/** Latest published publication for a question other than the one just published. */
async function findPriorPublishedForQuestion(
  questionId: string,
  excludeId: string,
): Promise<OgcodePublication | null> {
  // Reuse the public-facing lookup; if it returns the just-published row,
  // there's no prior to archive.
  const latest = await getPublishedPublicationForQuestion(questionId);
  if (!latest || latest.id === excludeId) return null;
  return latest;
}

// ─── Read operations ──────────────────────────────────────────────────────────

export async function listPublications(
  workspaceId: string,
  filter?: { status?: OgcodePublicationStatus | "all"; contributorUserId?: string },
): Promise<OgcodePublication[]> {
  return listOgcodePublications(workspaceId, filter);
}

export async function getModerationQueue(
  limit?: number,
): Promise<OgcodePublicationWithQuestion[]> {
  return listSubmittedPublications(limit);
}

export async function getPublicationDetail(
  workspaceId: string,
  publicationId: string,
): Promise<OgcodePublication | null> {
  return getOgcodePublication(workspaceId, publicationId);
}

/**
 * Origin AI uses this to fetch the stored full solution before generation.
 * Returns the question version so callers can read hint/full_solution/etc.
 */
export async function getPublishedSolutionForQuestion(
  questionId: string,
): Promise<{ publication: OgcodePublication; version: QuestionVersion } | null> {
  const publication = await getPublishedPublicationForQuestion(questionId);
  if (!publication) return null;
  const version = await getVersionById(publication.questionVersionId);
  if (!version) return null;
  return { publication, version };
}

export { submitForReview };
