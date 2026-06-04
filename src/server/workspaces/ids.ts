import { randomUUID } from "node:crypto";

export function createPrefixedId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
}

export function createWorkspaceId(): string {
  return createPrefixedId("ws");
}

export function createWorkspaceCodeId(): string {
  return createPrefixedId("wcode");
}

export function createAuditEventId(): string {
  return createPrefixedId("audit");
}

export function createBatchId(): string {
  return createPrefixedId("batch");
}

export function createEnrollmentId(): string {
  return createPrefixedId("enr");
}

export function createStudyMaterialId(): string {
  return createPrefixedId("smat");
}

export function createStudyMaterialAssetId(): string {
  return createPrefixedId("sasm");
}

export function createStudyMaterialAssignmentId(): string {
  return createPrefixedId("sasn");
}

export function createAnalyticsSnapshotId(): string {
  return createPrefixedId("asnap");
}

export function createOgcodePublicationId(): string {
  return createPrefixedId("ogpub");
}

export function createAssetId(): string {
  return createPrefixedId("asset");
}

export function createQuestionId(): string {
  return createPrefixedId("q");
}

export function createQuestionVersionId(): string {
  return createPrefixedId("qv");
}

export function createTestId(): string {
  return createPrefixedId("test");
}

export function createAssignmentId(): string {
  return createPrefixedId("asgn");
}

export function createAttemptId(): string {
  return createPrefixedId("att");
}

export function createDocumentImportJobId(): string {
  return createPrefixedId("dijob");
}

export function createImportJobPageId(): string {
  return createPrefixedId("ipage");
}

export function createImportJobQuestionId(): string {
  return createPrefixedId("iq");
}

export function createWorkspaceOfferingId(): string {
  return createPrefixedId("woff");
}

export function createEnrollmentOrderId(): string {
  return createPrefixedId("eord");
}

export function createPaymentIntentId(): string {
  return createPrefixedId("pint");
}

export function createPublicInstituteId(): string {
  return createPrefixedId("pinst");
}

// ─── Phase 14: teacher connection ──────────────────────────────────────────────

export function createCollaborationId(): string {
  return createPrefixedId("collab");
}

export function createSubjectGrantId(): string {
  return createPrefixedId("grant");
}

export function createEnrollmentSubscriptionId(): string {
  return createPrefixedId("esub");
}

export function createConnectJobId(): string {
  return createPrefixedId("cjob");
}
