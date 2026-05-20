/**
 * Per-phase feature flags for the teacher/institute/admin launch.
 * Each flag is independent so phases can ship without entangling rollback.
 *
 * Source: V1/teacher-admin-launch-plan/05-implementation-roadmap.md
 *
 * Defaults are conservative (off in production unless explicitly enabled);
 * dev/test default to on so local development gets the new surfaces.
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
  | "paidEnrollment";

type FlagSpec = {
  envSuffix: string;
  defaultDev: boolean;
  defaultProd: boolean;
};

const FLAG_SPECS: Record<FlagKey, FlagSpec> = {
  workspaces:        { envSuffix: "WORKSPACES",          defaultDev: true,  defaultProd: false },
  orgCodes:          { envSuffix: "ORG_CODES",           defaultDev: true,  defaultProd: false },
  enrollment:        { envSuffix: "ENROLLMENT",          defaultDev: true,  defaultProd: false },
  batches:           { envSuffix: "BATCHES",             defaultDev: true,  defaultProd: false },
  questionBag:       { envSuffix: "QUESTION_BAG",        defaultDev: true,  defaultProd: false },
  teacherTests:      { envSuffix: "TEACHER_TESTS",       defaultDev: true,  defaultProd: false },
  teacherRooms:      { envSuffix: "TEACHER_ROOMS",       defaultDev: true,  defaultProd: false },
  studyMaterials:    { envSuffix: "STUDY_MATERIALS",     defaultDev: false, defaultProd: false },
  teacherAnalytics:  { envSuffix: "TEACHER_ANALYTICS",   defaultDev: false, defaultProd: false },
  ogcodePublishing:  { envSuffix: "OGCODE_PUBLISHING",   defaultDev: false, defaultProd: false },
  documentImport:    { envSuffix: "DOCUMENT_IMPORT",     defaultDev: false, defaultProd: false },
  adminControlCenter:{ envSuffix: "ADMIN_CONTROL",       defaultDev: false, defaultProd: false },
  paidEnrollment:    { envSuffix: "PAID_ENROLLMENT",     defaultDev: false, defaultProd: false },
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
