/**
 * Organization code lifecycle helpers.
 *
 * Codes are case-insensitive: normalized to uppercase with non-alphanumeric
 * characters collapsed to '-'. The active partial unique index
 * (uq_active_workspace_code) enforces global uniqueness across reserved/active
 * statuses. Reserved/offensive substrings are blocked here so the DB never
 * sees them.
 */

import type { PoolClient } from "pg";

import { recordAuditEvent } from "./audit";
import {
  createWorkspaceCode,
  findActiveCodeByNormalized,
  listCodesForWorkspace,
  revokeWorkspaceCode,
} from "./store";
import type { WorkspaceCode, WorkspaceCodeType } from "./types";

const MIN_LENGTH = 4;
const MAX_LENGTH = 32;

const RESERVED_CODES = new Set([
  "ADMIN",
  "ORIGIN",
  "TEST",
  "DEMO",
  "PUBLIC",
  "PRIVATE",
  "STAFF",
  "TEACHER",
  "STUDENT",
  "SYSTEM",
  "OGCODE",
  "ROOT",
  "HELP",
  "SUPPORT",
  "NULL",
  "UNDEFINED",
]);

// Substrings only flagged when they appear as their own segment between
// dashes/word boundaries. Whole-word matching avoids false positives like
// "ADMIN-CLASS" (contains "ASS") or "CLASSIC" (contains "ASS").
const OFFENSIVE_WORDS = [
  "FUCK",
  "SHIT",
  "ASS",
  "BITCH",
  "RAPE",
  "PORN",
  "SEX",
  "NUDE",
  "NAZI",
  "HITLER",
];

export class WorkspaceCodeError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateCodeFormat(rawDisplay: string): string {
  const normalized = normalizeCode(rawDisplay);
  if (normalized.length < MIN_LENGTH) {
    throw new WorkspaceCodeError("too_short", `Code must be at least ${MIN_LENGTH} characters.`);
  }
  if (normalized.length > MAX_LENGTH) {
    throw new WorkspaceCodeError("too_long", `Code must be at most ${MAX_LENGTH} characters.`);
  }
  if (!/^[A-Z0-9-]+$/.test(normalized)) {
    throw new WorkspaceCodeError(
      "invalid_chars",
      "Use only letters, numbers, and dashes.",
    );
  }
  if (RESERVED_CODES.has(normalized)) {
    throw new WorkspaceCodeError("reserved", "This code is reserved. Choose a different one.");
  }
  const segments = normalized.split("-");
  for (const word of OFFENSIVE_WORDS) {
    if (segments.includes(word)) {
      throw new WorkspaceCodeError(
        "offensive",
        "This code is not allowed. Choose a different one.",
      );
    }
  }
  return normalized;
}

export type CodeAvailability =
  | { available: true; normalizedCode: string; displayCode: string }
  | { available: false; reason: string; normalizedCode: string | null };

export async function checkCodeAvailability(rawDisplay: string): Promise<CodeAvailability> {
  let normalized: string;
  try {
    normalized = validateCodeFormat(rawDisplay);
  } catch (error) {
    if (error instanceof WorkspaceCodeError) {
      return { available: false, reason: error.message, normalizedCode: null };
    }
    throw error;
  }
  const existing = await findActiveCodeByNormalized(normalized);
  if (existing) {
    return {
      available: false,
      reason: "This code is already in use. Pick another.",
      normalizedCode: normalized,
    };
  }
  return { available: true, normalizedCode: normalized, displayCode: rawDisplay.trim() };
}

function randomSuffix(length = 4): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateDefaultPersonalCode(displayName: string): { display: string; normalized: string } {
  const slug = normalizeCode(displayName).slice(0, 12) || "TEACHER";
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = `${slug}-${randomSuffix(4)}`;
    const normalized = normalizeCode(candidate);
    if (normalized.length >= MIN_LENGTH && normalized.length <= MAX_LENGTH) {
      return { display: candidate, normalized };
    }
  }
  const fallback = `TEACHER-${randomSuffix(6)}`;
  return { display: fallback, normalized: normalizeCode(fallback) };
}

export type CreateCodeInput = {
  workspaceId: string;
  createdBy: string;
  codeType: WorkspaceCodeType;
  rawDisplay: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
  batchId?: string | null;
  requestId?: string | null;
  client?: PoolClient;
};

export async function createCode(input: CreateCodeInput): Promise<WorkspaceCode> {
  const normalized = validateCodeFormat(input.rawDisplay);
  const existing = await findActiveCodeByNormalized(normalized);
  if (existing) {
    throw new WorkspaceCodeError("conflict", "This code is already in use.");
  }
  const code = await createWorkspaceCode({
    workspaceId: input.workspaceId,
    normalizedCode: normalized,
    displayCode: input.rawDisplay.trim(),
    codeType: input.codeType,
    createdBy: input.createdBy,
    batchId: input.batchId ?? null,
    expiresAt: input.expiresAt ?? null,
    metadata: input.metadata,
    client: input.client,
  });
  await recordAuditEvent({
    actorUserId: input.createdBy,
    workspaceId: input.workspaceId,
    entityType: "workspace_code",
    entityId: code.id,
    action: "code.created",
    after: code,
    requestId: input.requestId,
  });
  return code;
}

export type RotateCodeInput = {
  workspaceId: string;
  actorUserId: string;
  codeType: WorkspaceCodeType;
  newRawDisplay?: string;
  requestId?: string | null;
};

export async function rotateActiveCode(input: RotateCodeInput): Promise<WorkspaceCode> {
  const current = (await listCodesForWorkspace(input.workspaceId, input.codeType)).find(
    (entry) => entry.status === "active",
  );
  if (current) {
    const revoked = await revokeWorkspaceCode(current.id, input.workspaceId);
    if (revoked) {
      await recordAuditEvent({
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        entityType: "workspace_code",
        entityId: revoked.id,
        action: "code.revoked",
        before: current,
        after: revoked,
        requestId: input.requestId,
      });
    }
  }
  const display = input.newRawDisplay
    ? input.newRawDisplay
    : `${normalizeCode(current?.displayCode ?? "TEACHER").slice(0, 12) || "TEACHER"}-${randomSuffix(4)}`;
  return createCode({
    workspaceId: input.workspaceId,
    createdBy: input.actorUserId,
    codeType: input.codeType,
    rawDisplay: display,
    requestId: input.requestId,
  });
}

export async function revokeCodeById(input: {
  workspaceId: string;
  codeId: string;
  actorUserId: string;
  requestId?: string | null;
}): Promise<WorkspaceCode | null> {
  const before = (await listCodesForWorkspace(input.workspaceId)).find((c) => c.id === input.codeId);
  if (!before) return null;
  const revoked = await revokeWorkspaceCode(input.codeId, input.workspaceId);
  if (revoked) {
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: "workspace_code",
      entityId: revoked.id,
      action: "code.revoked",
      before,
      after: revoked,
      requestId: input.requestId,
    });
  }
  return revoked;
}
