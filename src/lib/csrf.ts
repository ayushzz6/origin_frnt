/**
 * Browser-side CSRF helpers.
 *
 * The middleware enforces a double-submit CSRF check on every mutating
 * /api/* request: the `origin_csrf` cookie must equal the
 * `x-csrf-token` header. Client components that hit the API with bare
 * `fetch()` would silently fail with 403 "Invalid CSRF token." until
 * this helper was added.
 */

const CSRF_COOKIE_NAME = "origin_csrf";

export function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  for (const cookie of document.cookie.split("; ")) {
    const [name, ...rest] = cookie.split("=");
    if (name === CSRF_COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Returns headers to merge into a mutating fetch() call. */
export function csrfHeaders(): Record<string, string> {
  const csrf = readCsrfCookie();
  return csrf ? { "x-csrf-token": csrf } : {};
}
