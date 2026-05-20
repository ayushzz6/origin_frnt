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
