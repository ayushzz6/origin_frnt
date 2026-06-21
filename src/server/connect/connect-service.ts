/**
 * Student-facing connect service (Phase 14, sections C + D).
 *
 * Flow 1 (teacher collects fees externally, issues a code):
 *   redeemConnectCode  → enroll `unassigned` into an ACTIVE collaborator
 *   grantConnectSubject → the student picks ONE Origin subject → a non-Razorpay,
 *                         time-bound `teacher_code` grant (entitlement is granted
 *                         here, not by a webhook — Flow 1 takes no payment).
 *
 * Browse:
 *   listActiveCollaborators / getCollaboratorProfile — active-collaborator-scoped
 *   projections over the existing public institute profile.
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "@/server/workspaces/audit";
import { joinByCode, JoinCodeError } from "@/server/workspaces/join";
import { normalizeCode } from "@/server/workspaces/codes";
import { findWorkspaceByActiveStudentJoinCode } from "@/server/workspaces/store";
import {
  getEnrollment,
  listStudentInstituteEnrollments,
} from "@/server/workspaces/enrollments";
import { listStudentBatchesAcrossWorkspaces } from "@/server/workspaces/batches";
import {
  getInstituteProfileService,
  listPublicInstitutesService,
} from "@/server/workspaces/marketplace-service";
import type {
  InstitutePublicProfile,
  WorkspaceStudentEnrollment,
  TeacherWorkspace,
  EnrollmentStatus,
} from "@/server/workspaces/types";
import { recomputeUserPremiumFlags } from "@/server/entitlements";
import { ALL_SUBJECTS, normalizeSubject, type Subject } from "@/lib/entitlements";

import { assertActiveCollaborator } from "./collaboration-service";
import { listActiveCollaborationWorkspaceIds } from "./collaboration-store";
import {
  getActiveWorkspaceTeacherCodeGrant,
  insertTeacherCodeGrant,
  listActiveWorkspaceGrantsForUser,
  revokeTeacherCodeGrant,
  type SubjectGrant,
} from "./subject-grants-store";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// ─── Browse ─────────────────────────────────────────────────────────────────

/** Active collaborators, as public institute profiles (verified-then-recent). */
export async function listActiveCollaborators(filter?: {
  subject?: string;
  city?: string;
  limit?: number;
}): Promise<InstitutePublicProfile[]> {
  const activeIds = new Set(await listActiveCollaborationWorkspaceIds());
  if (activeIds.size === 0) return [];
  const institutes = await listPublicInstitutesService({
    subject: filter?.subject,
    city: filter?.city,
    limit: filter?.limit ?? 60,
  });
  return institutes.filter((i) => activeIds.has(i.workspaceId));
}

/** A collaborator's full public profile (active-collaboration gate; null otherwise). */
export async function getCollaboratorProfile(
  workspaceId: string,
): Promise<InstitutePublicProfile | null> {
  if (!(await assertIsActiveOrNull(workspaceId))) return null;
  return getInstituteProfileService(workspaceId);
}

async function assertIsActiveOrNull(workspaceId: string): Promise<boolean> {
  try {
    await assertActiveCollaborator(workspaceId);
    return true;
  } catch {
    return false;
  }
}

// ─── My institutes ────────────────────────────────────────────────────────────

export type StudentInstituteBatch = {
  id: string;
  name: string;
  subject: string | null;
};

/** One institute the student is connected to, with their per-institute context. */
export type StudentInstitute = {
  workspaceId: string;
  displayName: string;
  city: string | null;
  state: string | null;
  country: string;
  verified: boolean;
  /** True when the institute is a live ORIGIN collaborator (browse-eligible). */
  isActiveCollaborator: boolean;
  /** The student's enrollment lifecycle at this institute. */
  enrollmentStatus: EnrollmentStatus;
  enrolledAt: string;
  /** Active batches the student has been assigned to at this institute. */
  batches: StudentInstituteBatch[];
  /** Origin subjects the student has unlocked at this institute (Flow-1 grants). */
  subjects: Subject[];
};

/**
 * The institutes a student is connected to — every workspace they have a live
 * enrollment in, with their batches and unlocked subjects per institute. This is
 * the data the student "My institutes" view needs: a connected student sees the
 * institute the moment they redeem a code (enrollment exists), even before any
 * subject is unlocked or a batch is assigned.
 *
 * Four indexed reads in parallel, assembled in memory (no N+1).
 */
export async function listStudentInstitutes(studentId: string): Promise<StudentInstitute[]> {
  const [enrollments, batches, grants, activeCollabIds] = await Promise.all([
    listStudentInstituteEnrollments(studentId),
    listStudentBatchesAcrossWorkspaces(studentId),
    listActiveWorkspaceGrantsForUser(studentId),
    listActiveCollaborationWorkspaceIds(),
  ]);
  if (enrollments.length === 0) return [];

  const activeSet = new Set(activeCollabIds);

  const batchesByWorkspace = new Map<string, StudentInstituteBatch[]>();
  for (const batch of batches) {
    const list = batchesByWorkspace.get(batch.workspaceId) ?? [];
    list.push({ id: batch.id, name: batch.name, subject: batch.subject });
    batchesByWorkspace.set(batch.workspaceId, list);
  }

  const subjectsByWorkspace = new Map<string, Set<Subject>>();
  for (const grant of grants) {
    const set = subjectsByWorkspace.get(grant.workspaceId) ?? new Set<Subject>();
    set.add(grant.subject);
    subjectsByWorkspace.set(grant.workspaceId, set);
  }

  return enrollments.map((enrollment) => ({
    workspaceId: enrollment.workspaceId,
    displayName: enrollment.workspaceDisplayName,
    city: enrollment.city,
    state: enrollment.state,
    country: enrollment.country,
    verified: enrollment.verified,
    isActiveCollaborator: activeSet.has(enrollment.workspaceId),
    enrollmentStatus: enrollment.status,
    enrolledAt: enrollment.enrolledAt,
    batches: batchesByWorkspace.get(enrollment.workspaceId) ?? [],
    subjects: [...(subjectsByWorkspace.get(enrollment.workspaceId) ?? [])],
  }));
}

// ─── Flow 1: redeem code ──────────────────────────────────────────────────────

export type RedeemConnectCodeResult = {
  workspace: TeacherWorkspace;
  enrollment: WorkspaceStudentEnrollment;
  isNew: boolean;
  /** The subjects the student may pick exactly one of, after redeeming. */
  eligibleSubjects: Subject[];
};

/**
 * Redeems a code for an ACTIVE collaborator and enrolls the student. The active-
 * collaboration gate runs BEFORE enrollment so a non-collaborator code never
 * creates a connect enrollment through this path (the generic Phase-3 join-code
 * endpoint still works for plain workspaces).
 */
export async function redeemConnectCode(input: {
  studentId: string;
  rawCode: string;
  requestId?: string | null;
}): Promise<RedeemConnectCodeResult> {
  const trimmed = input.rawCode.trim();
  if (!trimmed) throw new JoinCodeError(400, "Enter a join code.");
  const normalized = normalizeCode(trimmed);
  if (!normalized) throw new JoinCodeError(400, "Invalid join code format.");

  const hit = await findWorkspaceByActiveStudentJoinCode(normalized);
  if (!hit) throw new JoinCodeError(404, "We could not find an active workspace for that code.");

  await assertActiveCollaborator(hit.workspace.id);

  const result = await joinByCode({
    studentId: input.studentId,
    rawCode: input.rawCode,
    requestId: input.requestId,
  });

  return {
    workspace: result.workspace,
    enrollment: result.enrollment,
    isNew: result.isNew,
    eligibleSubjects: [...ALL_SUBJECTS],
  };
}

// ─── Flow 1: subject pick ─────────────────────────────────────────────────────

/**
 * Grants the student's chosen Origin subject for a collaborator enrollment. Pre-
 * checks: subject is one of the four billable subjects, the institute is an active
 * collaborator, the student has a live enrollment, and they have not already picked
 * a different subject for this institute (Flow 1 = exactly ONE free subject).
 * Idempotent for the same subject.
 */
export async function grantConnectSubject(input: {
  studentId: string;
  workspaceId: string;
  subject: string;
  requestId?: string | null;
}): Promise<SubjectGrant> {
  const subject = normalizeSubject(input.subject);
  if (!subject) throw new AuthzError(400, "Pick one of physics, chemistry, mathematics or biology.");

  await assertActiveCollaborator(input.workspaceId);

  const enrollment = await getEnrollment(input.workspaceId, input.studentId);
  if (!enrollment || enrollment.status === "left" || enrollment.status === "suspended") {
    throw new AuthzError(403, "Redeem the institute code before picking a subject.");
  }

  const existing = await getActiveWorkspaceTeacherCodeGrant(input.studentId, input.workspaceId);
  if (existing) {
    if (existing.subject === subject) return existing; // idempotent re-pick
    throw new AuthzError(
      409,
      "You have already unlocked a subject for this institute. Contact the institute to change it.",
    );
  }

  const expiresAt = new Date(Date.now() + ONE_YEAR_MS).toISOString();
  const { grant } = await insertTeacherCodeGrant({
    userId: input.studentId,
    subject,
    workspaceId: input.workspaceId,
    enrollmentId: enrollment.id,
    expiresAt,
    grantedBy: null,
  });

  // Entitlement changed → refresh the derived mirror + invalidate user caches.
  await recomputeUserPremiumFlags(input.studentId);

  await recordAuditEvent({
    actorUserId: input.studentId,
    workspaceId: input.workspaceId,
    entityType: "subject_grant",
    entityId: grant.id,
    action: "subject_grant.granted",
    after: grant,
    requestId: input.requestId,
  });

  return grant;
}

/**
 * Revokes a Flow-1 subject grant (institute/admin action). Recomputes the mirror
 * so the student's premium flags drop if this was their only entitlement.
 */
export async function revokeConnectSubject(input: {
  studentId: string;
  workspaceId: string;
  subject: string;
  actorUserId: string;
  requestId?: string | null;
}): Promise<SubjectGrant | null> {
  const subject = normalizeSubject(input.subject);
  if (!subject) throw new AuthzError(400, "Unknown subject.");

  const revoked = await revokeTeacherCodeGrant({
    userId: input.studentId,
    subject,
    workspaceId: input.workspaceId,
  });
  if (!revoked) return null;

  await recomputeUserPremiumFlags(input.studentId);

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "subject_grant",
    entityId: revoked.id,
    action: "subject_grant.revoked",
    before: revoked,
    after: { ...revoked, status: "revoked" },
    requestId: input.requestId,
  });

  return revoked;
}
