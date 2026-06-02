/**
 * Pure, client-safe entitlement predicates — Phase 1.3.
 *
 * These operate over an already-serialized `User` (specifically its
 * `entitledSubjects` array) and contain NO database access, so they are safe
 * to import from client components and RSC gates alike. The DB-backed source
 * of truth lives in `src/server/entitlements.ts`.
 *
 * See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 1.3 / 1.4).
 */

export type Subject = "physics" | "chemistry" | "mathematics" | "biology";

/** The four billable subjects. `mixed` is never an entitlement subject. */
export const ALL_SUBJECTS: Subject[] = ["physics", "chemistry", "mathematics", "biology"];

/** Free OG Code is limited to a fixed mixed sample pool of this size. */
export const FREE_SAMPLE_POOL_SIZE = 500;

/**
 * Gated student features. Global-unlock features open the moment a student
 * owns ANY subject; subject-bound features are filtered to the entitled set.
 */
export type Feature = "originAi" | "aiExplainer" | "studyRooms" | "tests" | "dpp" | "ogcodeFull";

export const GLOBAL_UNLOCK_FEATURES: Feature[] = ["originAi", "aiExplainer", "studyRooms"];
export const SUBJECT_BOUND_FEATURES: Feature[] = ["tests", "dpp", "ogcodeFull"];

export function isGlobalUnlockFeature(feature: Feature): boolean {
  return GLOBAL_UNLOCK_FEATURES.includes(feature);
}

/** Maps loose subject spellings (e.g. `maths`) to the canonical `Subject`. */
export function normalizeSubject(value: string | null | undefined): Subject | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "maths" || v === "math" || v === "mathematics") return "mathematics";
  if (v === "physics" || v === "phy") return "physics";
  if (v === "chemistry" || v === "chem") return "chemistry";
  if (v === "biology" || v === "bio") return "biology";
  return null;
}

export function isSubject(value: unknown): value is Subject {
  return typeof value === "string" && (ALL_SUBJECTS as string[]).includes(value);
}

type EntitledLike = {
  entitledSubjects?: ReadonlyArray<string> | null;
};

/** Normalised, deduped list of subjects the user is entitled to. */
export function getEntitledSubjects(user: EntitledLike | null | undefined): Subject[] {
  const raw = user?.entitledSubjects;
  if (!raw || raw.length === 0) return [];
  const out = new Set<Subject>();
  for (const value of raw) {
    const s = normalizeSubject(value);
    if (s) out.add(s);
  }
  return ALL_SUBJECTS.filter((s) => out.has(s));
}

/** True when the user owns at least one subject (premium of any kind). */
export function hasAnyPremium(user: EntitledLike | null | undefined): boolean {
  return getEntitledSubjects(user).length > 0;
}

/** True when the user owns the specific subject. */
export function canAccessSubject(user: EntitledLike | null | undefined, subject: string): boolean {
  const s = normalizeSubject(subject);
  if (!s) return false;
  return getEntitledSubjects(user).includes(s);
}

/**
 * Feature-level gate. Global-unlock features require any premium; subject-bound
 * features require the specific subject when one is supplied, otherwise any
 * premium (i.e. "can the user see this surface at all", filtered downstream).
 */
export function canAccessFeature(
  user: EntitledLike | null | undefined,
  feature: Feature,
  subject?: string | null,
): boolean {
  if (isGlobalUnlockFeature(feature)) return hasAnyPremium(user);
  if (subject) return canAccessSubject(user, subject);
  return hasAnyPremium(user);
}
