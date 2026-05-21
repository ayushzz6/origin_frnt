'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { handleGoogleLogin, handleLogin, handleRegister, handleRefresh, serializeUser, handleLoginWithOtp } from '@/server/users';
import { readStoreAsync, withStoreAsync } from '@/server/store';
import { getServerUser } from '@/lib/auth-server';
import {
  ACCESS_COOKIE_NAME,
  ACCESS_FINGERPRINT_COOKIE_NAME,
  COOKIE_OPTS_ACCESS,
  COOKIE_OPTS_ACCESS_FINGERPRINT,
  COOKIE_OPTS_CSRF,
  COOKIE_OPTS_REFRESH,
  CSRF_COOKIE_NAME,
  createCsrfToken,
  REFRESH_COOKIE_NAME,
} from '@/server/auth-jwt';
import { revokeRefreshSession } from '@/server/auth';
import type { User } from '@/types';

/**
 * Server-Action auth surface — the mutation path for every auth flow.
 *
 * Each action calls the shared domain handler in `@/server/users`, parses the
 * JSON response, mirrors the access + refresh tokens into HttpOnly cookies,
 * and returns just the user payload. The client never sees the raw tokens —
 * cookies are the session contract.
 */

type InternalAuthSuccess = { ok: true; user: User; access: string; refresh: string; accessFingerprint: string };
type AuthSuccess = { ok: true; user: User };
type AuthFailure = { ok: false; status: number; message: string };
type AuthResult = AuthSuccess | AuthFailure;
type InternalAuthResult = InternalAuthSuccess | AuthFailure;

function authActionFailure(operation: string, error: unknown): AuthFailure {
  console.error(`[auth-actions] ${operation} failed:`, error instanceof Error ? error.message : error);
  return {
    ok: false,
    status: 503,
    message: 'Authentication is temporarily unavailable. Please try again in a moment.',
  };
}

function toPublicAuthResult(result: InternalAuthResult): AuthResult {
  if (!result.ok) return result;
  return { ok: true, user: result.user };
}

async function parseAuthResponse(response: Response): Promise<InternalAuthResult> {
  let body: Record<string, unknown> = {};
  try {
    body = (await response.clone().json()) as Record<string, unknown>;
  } catch {
    // fall through
  }

  if (!response.ok) {
    const message =
      typeof body.detail === 'string'
        ? body.detail
        : typeof body.message === 'string'
          ? body.message
          : 'Authentication failed.';
    return { ok: false, status: response.status, message };
  }

  const access = typeof body.access === 'string' ? body.access : '';
  const refresh = typeof body.refresh === 'string' ? body.refresh : '';
  const accessFingerprint = typeof body.accessFingerprint === 'string' ? body.accessFingerprint : '';
  const user = body.user as User | undefined;
  if (!access || !accessFingerprint || !user) {
    return { ok: false, status: 500, message: 'Malformed auth response.' };
  }

  return { ok: true, user, access, refresh, accessFingerprint };
}

async function setSessionCookies(access: string, refresh: string, accessFingerprint: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, access, COOKIE_OPTS_ACCESS);
  cookieStore.set(ACCESS_FINGERPRINT_COOKIE_NAME, accessFingerprint, COOKIE_OPTS_ACCESS_FINGERPRINT);
  if (refresh) {
    cookieStore.set(REFRESH_COOKIE_NAME, refresh, COOKIE_OPTS_REFRESH);
  }
  cookieStore.set(CSRF_COOKIE_NAME, createCsrfToken(), COOKIE_OPTS_CSRF);
}

export async function loginAction(input: {
  email: string;
  password: string;
  role?: 'student' | 'teacher' | 'admin' | null;
}): Promise<AuthResult> {
  try {
    const response = await handleLogin({
      email: input.email,
      password: input.password,
      role: input.role ?? undefined,
    });
    const parsed = await parseAuthResponse(response);
    if (parsed.ok) {
      await setSessionCookies(parsed.access, parsed.refresh, parsed.accessFingerprint);
      revalidatePath('/', 'layout');
    }
    return toPublicAuthResult(parsed);
  } catch (error) {
    return authActionFailure('loginAction', error);
  }
}

export async function loginWithOtpAction(input: {
  email: string;
  role?: 'student' | 'teacher' | 'admin' | null;
}): Promise<AuthResult> {
  try {
    const response = await handleLoginWithOtp({
      email: input.email,
      role: input.role ?? undefined,
    });
    const parsed = await parseAuthResponse(response);
    if (parsed.ok) {
      await setSessionCookies(parsed.access, parsed.refresh, parsed.accessFingerprint);
      revalidatePath('/', 'layout');
    }
    return toPublicAuthResult(parsed);
  } catch (error) {
    return authActionFailure('loginWithOtpAction', error);
  }
}

export async function registerAction(input: {
  name?: string;
  email: string;
  password: string;
  role?: 'student' | 'teacher' | 'admin' | null;
}): Promise<AuthResult> {
  try {
    // Check if email was verified via OTP
    const store = await readStoreAsync();
    const isVerified = store.otps.some(o => o.email.toLowerCase() === input.email.toLowerCase() && o.verified === true);
    
    if (!isVerified) {
      return { ok: false, status: 400, message: 'Email verification required. Please verify your email first.' };
    }

    const response = await handleRegister({
      name: input.name,
      email: input.email,
      password: input.password,
      role: input.role ?? undefined,
    });
    const parsed = await parseAuthResponse(response);
    if (parsed.ok) {
      try {
        await withStoreAsync(async (cleanupStore) => {
          cleanupStore.otps = cleanupStore.otps.filter(o => o.email.toLowerCase() !== input.email.toLowerCase());
        });
      } catch (cleanupError) {
        console.error(
          '[auth-actions] OTP cleanup failed after successful registration:',
          cleanupError instanceof Error ? cleanupError.message : cleanupError,
        );
      }

      await setSessionCookies(parsed.access, parsed.refresh, parsed.accessFingerprint);
      revalidatePath('/', 'layout');
    }
    return toPublicAuthResult(parsed);
  } catch (error) {
    return authActionFailure('registerAction', error);
  }
}

export async function googleLoginAction(input: { credential: string; role?: 'student' | 'teacher' | 'admin' | null }): Promise<AuthResult> {
  try {
    const response = await handleGoogleLogin({ credential: input.credential, role: input.role ?? null });
    const parsed = await parseAuthResponse(response);
    if (parsed.ok) {
      await setSessionCookies(parsed.access, parsed.refresh, parsed.accessFingerprint);
      revalidatePath('/', 'layout');
    }
    return toPublicAuthResult(parsed);
  } catch (error) {
    return authActionFailure('googleLoginAction', error);
  }
}

/**
 * Refreshes the access token using the HttpOnly refresh cookie. Returns the
 * new short-lived access cookie value; callers don't need the value itself —
 * the cookie is already rotated on return. Used by client-side fetch paths
 * after a 401 without shipping the refresh token to JS.
 */
export async function refreshTokenAction(): Promise<{ ok: boolean; status: number }> {
  const cookieStore = await cookies();
  const refresh = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
  if (!refresh) return { ok: false, status: 400 };

  const response = await handleRefresh(null, { refresh });
  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await response.clone().json()) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 502 };
  }

  const access = typeof body.access === 'string' ? body.access : '';
  const newRefresh = typeof body.refresh === 'string' ? body.refresh : '';
  const accessFingerprint = typeof body.accessFingerprint === 'string' ? body.accessFingerprint : '';
  if (!access || !accessFingerprint) return { ok: false, status: 502 };

  await setSessionCookies(access, newRefresh, accessFingerprint);
  return { ok: true, status: response.status };
}

/**
 * Returns the current user (or null) resolved from the access-token cookie.
 * Replaces the client-side `apiCall('/users/me/')` hop in `AuthContext.refreshUser`.
 */
export async function refreshUserAction(): Promise<User | null> {
  const stored = await getServerUser();
  if (!stored) return null;
  const store = await readStoreAsync();
  const payload = serializeUser(store, stored.id);
  return (payload as unknown as User) ?? null;
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  await revokeRefreshSession(cookieStore.get(REFRESH_COOKIE_NAME)?.value);
  cookieStore.set(ACCESS_COOKIE_NAME, '', { ...COOKIE_OPTS_ACCESS, maxAge: 0 });
  cookieStore.set(ACCESS_FINGERPRINT_COOKIE_NAME, '', { ...COOKIE_OPTS_ACCESS_FINGERPRINT, maxAge: 0 });
  cookieStore.set(REFRESH_COOKIE_NAME, '', { ...COOKIE_OPTS_REFRESH, maxAge: 0 });
  cookieStore.set(CSRF_COOKIE_NAME, '', { ...COOKIE_OPTS_CSRF, maxAge: 0 });
  revalidatePath('/', 'layout');
}
