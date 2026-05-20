/**
 * Workspace onboarding for an already-authenticated teacher account.
 *
 * The existing /api/users/register flow creates the user; this step provisions
 * either a personal teacher workspace (with a default rotatable join code) or
 * an institute workspace (with a user-chosen organization code).
 */

import { createTeacherWorkspace } from "./service";
import {
  createCode,
  generateDefaultPersonalCode,
  validateCodeFormat,
  WorkspaceCodeError,
} from "./codes";
import type { TeacherWorkspace, WorkspaceCode } from "./types";

export type PersonalOnboardingInput = {
  ownerUserId: string;
  displayName: string;
  subjects?: string[];
  city?: string | null;
  state?: string | null;
  requestId?: string | null;
};

export type InstituteOnboardingInput = {
  ownerUserId: string;
  displayName: string;
  legalName?: string | null;
  rawCode: string;
  subjects?: string[];
  courses?: string[];
  city?: string | null;
  state?: string | null;
  requestId?: string | null;
};

export type OnboardingResult = {
  workspace: TeacherWorkspace;
  joinCode: WorkspaceCode;
};

export async function onboardPersonalTeacher(
  input: PersonalOnboardingInput,
): Promise<OnboardingResult> {
  const workspace = await createTeacherWorkspace({
    workspaceType: "personal",
    ownerUserId: input.ownerUserId,
    displayName: input.displayName,
    subjects: input.subjects ?? [],
    city: input.city ?? null,
    state: input.state ?? null,
    requestId: input.requestId,
  });

  // generateDefaultPersonalCode is best-effort unique; on rare collisions the
  // partial unique index forces a retry up to a few attempts.
  let code: WorkspaceCode | null = null;
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = generateDefaultPersonalCode(input.displayName);
    try {
      code = await createCode({
        workspaceId: workspace.id,
        createdBy: input.ownerUserId,
        codeType: "student_join",
        rawDisplay: candidate.display,
        requestId: input.requestId,
        metadata: { source: "auto_personal_default" },
      });
    } catch (error) {
      if (error instanceof WorkspaceCodeError && error.code === "conflict") {
        continue;
      }
      throw error;
    }
  }
  if (!code) {
    throw new Error("Could not generate a unique default join code after retries.");
  }
  return { workspace, joinCode: code };
}

export async function onboardInstitute(
  input: InstituteOnboardingInput,
): Promise<OnboardingResult> {
  // Validate upfront so we don't create the workspace just to fail on the code.
  const normalized = validateCodeFormat(input.rawCode);
  const workspace = await createTeacherWorkspace({
    workspaceType: "institute",
    ownerUserId: input.ownerUserId,
    displayName: input.displayName,
    legalName: input.legalName ?? null,
    subjects: input.subjects ?? [],
    courses: input.courses ?? [],
    city: input.city ?? null,
    state: input.state ?? null,
    requestId: input.requestId,
  });

  const code = await createCode({
    workspaceId: workspace.id,
    createdBy: input.ownerUserId,
    codeType: "student_join",
    rawDisplay: normalized,
    requestId: input.requestId,
    metadata: { source: "institute_signup" },
  });

  return { workspace, joinCode: code };
}
