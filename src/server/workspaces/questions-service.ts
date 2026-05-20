/**
 * Question Bag service layer.
 * Encodes business rules:
 * - Minimum required fields for draft/ready questions.
 * - OGCode publish gate: hint + full_solution + answer data are mandatory.
 * - Edit always creates a new version.
 * - Audit events on question lifecycle transitions.
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "./audit";
import {
  createQuestion,
  createVersion,
  createAsset,
  getQuestionById,
  getQuestionWithVersion,
  getVersionById,
  linkAssetToVersion,
  listQuestions,
  updateQuestion,
  type CreateQuestionInput,
  type CreateVersionInput,
  type CreateAssetInput,
} from "./questions";
import type {
  Question,
  QuestionOption,
  QuestionStatus,
  QuestionType,
  QuestionVersion,
  QuestionWithVersion,
  Asset,
  QuestionAssetPurpose,
} from "./types";

export type CreateQuestionInputFull = CreateQuestionInput & {
  questionType: QuestionType;
  stem: string;
  options?: QuestionOption[] | null;
  correctOption?: number | null;
  correctOptions?: number[] | null;
  answerText?: string | null;
  answerSpec?: Record<string, unknown> | null;
  matrixData?: Record<string, unknown> | null;
  hint?: string | null;
  explanation?: string | null;
  fullSolution?: string | null;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: "easy" | "medium" | "hard" | "insane";
  tags?: string[];
  requestId?: string | null;
  actorUserId: string;
};

export async function createTeacherQuestion(input: CreateQuestionInputFull): Promise<QuestionWithVersion> {
  if (!input.stem.trim()) {
    throw new AuthzError(400, "Question stem is required.");
  }
  if (!input.subject.trim()) {
    throw new AuthzError(400, "Subject is required.");
  }
  if (!input.chapter.trim()) {
    throw new AuthzError(400, "Chapter is required.");
  }
  if (!input.concept.trim()) {
    throw new AuthzError(400, "Concept/topic is required.");
  }

  const validTypes: QuestionType[] = [
    "mcq", "msq", "numerical", "numerical_with_units",
    "symbolic_expression", "equation", "matrix_match", "subjective",
  ];
  if (!validTypes.includes(input.questionType)) {
    throw new AuthzError(400, "Invalid question type.");
  }

  const question = await createQuestion({
    workspaceId: input.workspaceId,
    createdBy: input.createdBy,
    sourceKind: input.sourceKind ?? "manual",
    importedJobId: input.importedJobId,
    externalSourceId: input.externalSourceId,
  });

  const version = await createVersion({
    questionId: question.id,
    createdBy: input.createdBy,
    questionType: input.questionType,
    stem: input.stem.trim(),
    options: input.options ?? null,
    correctOption: input.correctOption ?? null,
    correctOptions: input.correctOptions ?? null,
    answerText: input.answerText ?? null,
    answerSpec: input.answerSpec ?? null,
    matrixData: input.matrixData ?? null,
    hint: input.hint ?? null,
    explanation: input.explanation ?? null,
    fullSolution: input.fullSolution ?? null,
    subject: input.subject.trim(),
    chapter: input.chapter.trim(),
    concept: input.concept.trim(),
    difficulty: input.difficulty,
    tags: input.tags ?? [],
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "question",
    entityId: question.id,
    action: "question.created",
    after: { question, version },
    requestId: input.requestId,
  });

  return getQuestionWithVersion(question.id) as Promise<QuestionWithVersion>;
}

export type EditQuestionInput = {
  actorUserId: string;
  workspaceId: string;
  questionId: string;
  requestId?: string | null;
} & Omit<CreateVersionInput, "questionId" | "createdBy">;

export async function editTeacherQuestion(input: EditQuestionInput): Promise<QuestionVersion> {
  const existing = await getQuestionById(input.questionId);
  if (!existing) {
    throw new AuthzError(404, "Question not found.");
  }
  if (existing.workspaceId !== input.workspaceId) {
    throw new AuthzError(403, "Question does not belong to this workspace.");
  }

  const version = await createVersion({
    questionId: input.questionId,
    createdBy: input.actorUserId,
    questionType: input.questionType,
    stem: input.stem,
    options: input.options ?? null,
    correctOption: input.correctOption ?? null,
    correctOptions: input.correctOptions ?? null,
    answerText: input.answerText ?? null,
    answerSpec: input.answerSpec ?? null,
    matrixData: input.matrixData ?? null,
    hint: input.hint ?? null,
    explanation: input.explanation ?? null,
    fullSolution: input.fullSolution ?? null,
    subject: input.subject,
    chapter: input.chapter,
    concept: input.concept,
    difficulty: input.difficulty,
    tags: input.tags ?? [],
    importEvidence: input.importEvidence ?? {},
    metadata: input.metadata ?? {},
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "question",
    entityId: input.questionId,
    action: "question.versioned",
    after: version,
    requestId: input.requestId,
  });

  return version;
}

export type PublishPrivateInput = {
  actorUserId: string;
  workspaceId: string;
  questionId: string;
  requestId?: string | null;
};

export async function publishPrivateQuestion(input: PublishPrivateInput): Promise<Question> {
  const question = await getQuestionById(input.questionId);
  if (!question) throw new AuthzError(404, "Question not found.");
  if (question.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  if (question.status !== "draft" && question.status !== "needs_review") {
    throw new AuthzError(400, "Only draft or needs_review questions can be published as private.");
  }

  const updated = await updateQuestion(input.questionId, {
    status: "ready",
    visibility: "workspace",
  });
  if (!updated) throw new Error("Failed to publish question.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "question",
    entityId: input.questionId,
    action: "question.published_private",
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}

export type OgCodePublishInput = {
  actorUserId: string;
  workspaceId: string;
  questionId: string;
  attributionName: string;
  requestId?: string | null;
};

export function validateOgCodePublish(version: QuestionVersion | null): void {
  if (!version) throw new AuthzError(400, "Question has no version to publish.");
  if (!version.answerText && version.correctOption === null && !version.answerSpec && !version.correctOptions) {
    throw new AuthzError(400, "Answer data is required before publishing to OGCode.");
  }
  if (!version.hint) {
    throw new AuthzError(400, "A hint is required before publishing to OGCode.");
  }
  if (!version.fullSolution) {
    throw new AuthzError(400, "A full solved solution is required before publishing to OGCode.");
  }
}

export async function submitToOgCode(input: OgCodePublishInput): Promise<Question> {
  const question = await getQuestionById(input.questionId);
  if (!question) throw new AuthzError(404, "Question not found.");
  if (question.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");

  if (question.status === "published_ogcode") {
    throw new AuthzError(400, "Question is already published on OGCode.");
  }

  const version = question.currentVersionId ? await getVersionById(question.currentVersionId) : null;
  validateOgCodePublish(version);

  const updated = await updateQuestion(input.questionId, {
    status: "submitted_to_ogcode",
    visibility: "public_ogcode",
  });
  if (!updated) throw new Error("Failed to submit question.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "question",
    entityId: input.questionId,
    action: "question.submitted_ogcode",
    after: { question: updated, attributionName: input.attributionName },
    requestId: input.requestId,
  });

  return updated;
}

export async function attachAsset(input: {
  actorUserId: string;
  workspaceId: string;
  questionId: string;
  versionId: string;
  assetInput: CreateAssetInput;
  purpose: QuestionAssetPurpose;
  displayOrder?: number;
  requestId?: string | null;
}): Promise<Asset> {
  const question = await getQuestionById(input.questionId);
  if (!question) throw new AuthzError(404, "Question not found.");
  if (question.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");

  const asset = await createAsset({
    ...input.assetInput,
    ownerType: "workspace",
    ownerWorkspaceId: input.workspaceId,
    createdBy: input.actorUserId,
  });

  await linkAssetToVersion({
    questionVersionId: input.versionId,
    assetId: asset.id,
    purpose: input.purpose,
    displayOrder: input.displayOrder ?? 0,
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "question",
    entityId: input.questionId,
    action: "question.asset_attached",
    after: { assetId: asset.id, purpose: input.purpose },
    requestId: input.requestId,
  });

  return asset;
}

export async function listTeacherQuestions(
  workspaceId: string,
  filter?: {
    status?: QuestionStatus | "all";
    subject?: string;
    chapter?: string;
    difficulty?: "easy" | "medium" | "hard" | "insane";
    questionType?: QuestionType;
    search?: string;
  },
): Promise<QuestionWithVersion[]> {
  return listQuestions(workspaceId, filter ?? {});
}

export async function getTeacherQuestion(
  workspaceId: string,
  questionId: string,
): Promise<QuestionWithVersion | null> {
  const question = await getQuestionById(questionId);
  if (!question) return null;
  if (question.workspaceId !== workspaceId) return null;
  return getQuestionWithVersion(questionId);
}

export async function archiveQuestion(input: {
  actorUserId: string;
  workspaceId: string;
  questionId: string;
  requestId?: string | null;
}): Promise<Question> {
  const question = await getQuestionById(input.questionId);
  if (!question) throw new AuthzError(404, "Question not found.");
  if (question.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");

  const updated = await updateQuestion(input.questionId, { status: "archived" });
  if (!updated) throw new Error("Failed to archive question.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "question",
    entityId: input.questionId,
    action: "question.archived",
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}

export async function markNeedsReview(input: {
  actorUserId: string;
  workspaceId: string;
  questionId: string;
  requestId?: string | null;
}): Promise<Question> {
  const question = await getQuestionById(input.questionId);
  if (!question) throw new AuthzError(404, "Question not found.");
  if (question.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");

  const updated = await updateQuestion(input.questionId, { status: "needs_review" });
  if (!updated) throw new Error("Failed to mark question needs review.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "question",
    entityId: input.questionId,
    action: "question.marked_needs_review",
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}