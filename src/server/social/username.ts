/**
 * Pure helpers for student-social @username handles. No DB access — global
 * uniqueness is enforced by the unique index on origin_users(LOWER(username)).
 * These helpers normalise/validate user input and generate collision-free
 * defaults that mirror the SQL backfill in 20260623_student_social.sql.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

/** Lowercase alphanumeric slug of a display name, capped for use as a handle base. */
export function slugifyName(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 15);
}

/** The already-unique suffix of a `user_<hex>` id (everything after the first underscore). */
export function idSuffix(id: string): string {
  const idx = id.indexOf("_");
  return (idx >= 0 ? id.slice(idx + 1) : id).toLowerCase();
}

/**
 * Deterministic, collision-free default handle for a user. Mirrors the SQL
 * backfill: slug(name) + "_" + unique id suffix, falling back to "user_<id>"
 * when the name has no usable characters. Users can change it later.
 */
export function defaultUsernameFor(name: string | null | undefined, id: string): string {
  const base = slugifyName(name);
  const suffix = idSuffix(id);
  if (!base) return `user_${suffix || id.toLowerCase()}`;
  return `${base}_${suffix}`;
}

/** Normalise raw user input toward a valid handle (lowercase, strip invalid chars). */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "");
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_PATTERN.test(raw);
}
