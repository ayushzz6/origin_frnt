/**
 * Browser-side fetch helpers for the teacher/* API surface.
 * Use only inside "use client" components.
 */

const CSRF_COOKIE_NAME = "origin_csrf";

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split("=");
    if (name === CSRF_COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; detail: string };

export async function apiJson<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<ApiResult<T>> {
  const { json, headers, ...rest } = init;
  const requestHeaders: Record<string, string> = {
    ...(Object.fromEntries((headers as Headers | undefined)?.entries?.() ?? []) as Record<string, string>),
    ...((headers as Record<string, string> | undefined) ?? {}),
    Accept: "application/json",
  };
  if (json !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    const csrf = readCsrfCookie();
    if (csrf) requestHeaders["x-csrf-token"] = csrf;
  }
  const response = await fetch(path, {
    ...rest,
    headers: requestHeaders,
    body: json === undefined ? rest.body : JSON.stringify(json),
    credentials: "include",
  });
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const detail =
      (parsed && typeof parsed === "object" && "detail" in parsed
        ? String((parsed as { detail: unknown }).detail)
        : null) ?? response.statusText;
    return { ok: false, status: response.status, detail };
  }
  return { ok: true, data: parsed as T };
}
