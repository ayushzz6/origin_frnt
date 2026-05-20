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
