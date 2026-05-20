/**
 * Student-side join: redeem an organization code to enroll into the
 * corresponding workspace. The enrollment status starts as 'unassigned'
 * unless the code is batch-specific (Phase 6+); for Phase 3 the student
 * lands in the unassigned queue and waits for staff to place them in a batch.
 */

import { recordAuditEvent } from "./audit";
import { normalizeCode } from "./codes";
import { enrollStudent } from "./enrollments";
import { findWorkspaceByActiveStudentJoinCode } from "./store";
import type { WorkspaceStudentEnrollment, TeacherWorkspace } from "./types";

export class JoinCodeError extends Error {
  status: 400 | 404 | 409;
  constructor(status: 400 | 404 | 409, message: string) {
    super(message);
    this.status = status;
  }
}

export type JoinByCodeResult = {
  workspace: TeacherWorkspace;
  enrollment: WorkspaceStudentEnrollment;
  isNew: boolean;
};

export async function joinByCode(input: {
  studentId: string;
  rawCode: string;
  requestId?: string | null;
}): Promise<JoinByCodeResult> {
  const trimmed = input.rawCode.trim();
  if (!trimmed) {
    throw new JoinCodeError(400, "Enter a join code.");
  }
  const normalized = normalizeCode(trimmed);
  if (!normalized) {
    throw new JoinCodeError(400, "Invalid join code format.");
  }
  const hit = await findWorkspaceByActiveStudentJoinCode(normalized);
  if (!hit) {
    throw new JoinCodeError(404, "We could not find an active workspace for that code.");
  }
  const { workspace, code } = hit;
  if (workspace.status === "suspended" || workspace.status === "closed") {
    throw new JoinCodeError(409, "This workspace is not accepting enrollments right now.");
  }
  const { enrollment, isNew } = await enrollStudent({
    workspaceId: workspace.id,
    studentId: input.studentId,
    source: "code",
    joinCodeId: code.id,
  });
  if (isNew) {
    await recordAuditEvent({
      actorUserId: input.studentId,
      workspaceId: workspace.id,
      entityType: "workspace_student_enrollment",
      entityId: enrollment.id,
      action: "enrollment.created",
      after: enrollment,
      requestId: input.requestId,
    });
  }
  return { workspace, enrollment, isNew };
}
