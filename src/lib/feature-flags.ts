/**
 * Per-phase feature flags for the teacher/institute/admin launch.
 * Each flag is independent so phases can ship without entangling rollback.
 *
 * Source: V1/teacher-admin-launch-plan/05-implementation-roadmap.md
 *
 * After all 13 phases shipped to production, defaults are flipped on
 * for both dev and prod so the launch surfaces are visible by default.
 * Individual flags can still be flipped off per-environment via the
 * `TEACHER_LAUNCH_<SUFFIX>` env var or via the runtime kill-switch in
 * /admin/incidents (which calls setFlagOverride and overrides the
 * default at request time).
 */

const FLAG_ENV_PREFIX = "TEACHER_LAUNCH_";

type FlagKey =
  | "workspaces"
  | "orgCodes"
  | "enrollment"
  | "batches"
  | "questionBag"
  | "teacherTests"
  | "teacherRooms"
  | "studyMaterials"
  | "teacherAnalytics"
  | "ogcodePublishing"
  | "documentImport"
  | "adminControlCenter"
  | "paidEnrollment"
  | "premiumSubscriptions"
  | "teacherConnect"
  | "teacherOgcode"
  | "liveRooms";

type FlagSpec = {
  envSuffix: string;
  defaultDev: boolean;
  defaultProd: boolean;
};

const FLAG_SPECS: Record<FlagKey, FlagSpec> = {
  workspaces:        { envSuffix: "WORKSPACES",          defaultDev: true,  defaultProd: true },
  orgCodes:          { envSuffix: "ORG_CODES",           defaultDev: true,  defaultProd: true },
  enrollment:        { envSuffix: "ENROLLMENT",          defaultDev: true,  defaultProd: true },
  batches:           { envSuffix: "BATCHES",             defaultDev: true,  defaultProd: true },
  questionBag:       { envSuffix: "QUESTION_BAG",        defaultDev: true,  defaultProd: true },
  teacherTests:      { envSuffix: "TEACHER_TESTS",       defaultDev: true,  defaultProd: true },
  teacherRooms:      { envSuffix: "TEACHER_ROOMS",       defaultDev: true,  defaultProd: true },
  studyMaterials:    { envSuffix: "STUDY_MATERIALS",     defaultDev: true,  defaultProd: true },
  teacherAnalytics:  { envSuffix: "TEACHER_ANALYTICS",   defaultDev: true,  defaultProd: true },
  ogcodePublishing:  { envSuffix: "OGCODE_PUBLISHING",   defaultDev: true,  defaultProd: true },
  documentImport:    { envSuffix: "DOCUMENT_IMPORT",     defaultDev: true,  defaultProd: true },
  adminControlCenter:{ envSuffix: "ADMIN_CONTROL",       defaultDev: true,  defaultProd: true },
  paidEnrollment:    { envSuffix: "PAID_ENROLLMENT",     defaultDev: true,  defaultProd: true },
  // Phase 13 — Free vs Premium per-subject subscriptions. Shipped + enabled in
  // production (TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS=1); defaults flipped ON to
  // match prod and remove the silent dark default. Per-env env var still overrides.
  premiumSubscriptions: { envSuffix: "PREMIUM_SUBSCRIPTIONS", defaultDev: true, defaultProd: true },
  // Phase 14 — Student ↔ teacher connection (collaborations, /connect, both
  // enrollment flows, teacher tests/rooms → student, teacher analytics). Shipped +
  // enabled in production (TEACHER_LAUNCH_TEACHER_CONNECT=1); defaults flipped ON.
  teacherConnect: { envSuffix: "TEACHER_CONNECT", defaultDev: true, defaultProd: true },
  // Phase 15 — Teacher OG Code bank browse + OG-Code-as-a-source in the test
  // builder (general + room tests). Shipped + enabled in production; defaults
  // flipped ON. The Phase-0 mixed-source take/grade fix is unflagged (correctness).
  teacherOgcode: { envSuffix: "TEACHER_OGCODE", defaultDev: true, defaultProd: true },
  // Teacher Live Rooms — real-time room shell (chat + typing + presence),
  // 60s rotating / permanent join codes, kick + participant search, Start-Test
  // auto-stop, post-test leaderboard + analytics, and hard delete. Ships **dark**
  // in prod (TEACHER_LAUNCH_LIVE_ROOMS=1 to enable) until verified end-to-end;
  // enabled in dev by default. Gates the new live surfaces/routes; the existing
  // teacherRooms CRUD stays independently flagged.
  liveRooms: { envSuffix: "LIVE_ROOMS", defaultDev: true, defaultProd: false },
};

function parseFlag(raw: string | undefined): boolean | null {
  if (raw == null) return null;
  const lowered = raw.trim().toLowerCase();
  if (lowered === "1" || lowered === "true" || lowered === "on" || lowered === "yes") return true;
  if (lowered === "0" || lowered === "false" || lowered === "off" || lowered === "no") return false;
  return null;
}

export function isFeatureEnabled(flag: FlagKey): boolean {
  const spec = FLAG_SPECS[flag];
  const explicit = parseFlag(process.env[`${FLAG_ENV_PREFIX}${spec.envSuffix}`]);
  if (explicit !== null) return explicit;
  const isProd = process.env.NODE_ENV === "production";
  return isProd ? spec.defaultProd : spec.defaultDev;
}

export function requireFeatureEnabled(flag: FlagKey): void {
  if (!isFeatureEnabled(flag)) {
    throw new FeatureDisabledError(flag);
  }
}

export class FeatureDisabledError extends Error {
  flag: FlagKey;
  constructor(flag: FlagKey) {
    super(`Feature '${flag}' is not enabled in this environment.`);
    this.flag = flag;
  }
}

export type { FlagKey };
