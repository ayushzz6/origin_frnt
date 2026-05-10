import type { AppStore, StoredAuthSession, StoredUser } from "@/server/store";
import { createId, readStoreAsync } from "@/server/store";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import {
  dbClearUserSessions,
  dbCreateAuthSession,
  dbFindUserById,
  dbRevokeAuthSessionByRefreshToken,
  dbRotateAccessToken,
} from "@/server/db-users";
import {
  ACCESS_COOKIE_NAME,
  createRefreshToken,
  createSessionId,
  extractAccessToken,
  extractBearerToken,
  extractRefreshToken,
  hashRefreshTokenSecret,
  issueAccessTokenForUser,
  parseRefreshToken,
} from "@/server/auth-jwt";
import { getAuthContext } from "@/server/authz";

const ACCESS_TOKEN_TTL_MS = 10 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export { extractBearerToken };

export function extractCookieToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === ACCESS_COOKIE_NAME) {
      const value = rawValue.join("=");
      return value ? decodeURIComponent(value) : null;
    }
  }

  return null;
}

export function extractRefreshTokenCookie(request: Request): string | null {
  return extractRefreshToken(request);
}

function isTokenExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt) <= new Date();
}

export function findUserByAccessToken(store: AppStore, accessToken: string | null): StoredUser | null {
  if (!accessToken) {
    return null;
  }
  const session = store.authSessions.find((entry) => entry.accessToken === accessToken);
  if (!session || isTokenExpired(session.accessTokenExpiresAt)) {
    return null;
  }
  return store.users.find((user) => user.id === session.userId) ?? null;
}

export async function isRefreshTokenValid(store: AppStore, refreshToken: string): Promise<StoredAuthSession | null> {
  const parsed = parseRefreshToken(refreshToken);
  if (parsed) {
    const expectedHash = await hashRefreshTokenSecret(parsed.secret);
    const session = store.authSessions.find((entry) => entry.id === parsed.sessionId);
    if (!session || session.revokedAt || isTokenExpired(session.refreshTokenExpiresAt)) {
      return null;
    }
    if (session.refreshTokenHash && session.refreshTokenHash !== expectedHash) {
      session.revokedAt = new Date().toISOString();
      return null;
    }
    return session;
  }

  const session = store.authSessions.find((entry) => entry.refreshToken === refreshToken);
  if (!session || session.revokedAt || isTokenExpired(session.refreshTokenExpiresAt)) {
    return null;
  }
  return session;
}

export async function requireUserFromRequest(store: AppStore, request: Request): Promise<StoredUser | null> {
  const context = await getAuthContext(request);
  if (!context) {
    return null;
  }
  const user = store.users.find((entry) => entry.id === context.userId) ?? null;
  if (!user || (user.authTokenVersion ?? 0) !== context.tokenVersion) {
    return null;
  }
  return user;
}

export function createAuthSession(store: AppStore, userId: string): StoredAuthSession {
  const now = Date.now();
  const session: StoredAuthSession = {
    id: createId("session"),
    accessToken: createId("access"),
    refreshToken: createId("refresh"),
    userId,
    createdAt: new Date(now).toISOString(),
    accessTokenExpiresAt: new Date(now + ACCESS_TOKEN_TTL_MS).toISOString(),
    refreshTokenExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString(),
    revokedAt: null,
    lastUsedAt: null,
    userAgentHash: null,
    ipPrefixHash: null,
  };

  store.authSessions = store.authSessions.filter((entry) => entry.userId !== userId);
  store.authSessions.push(session);
  return session;
}

export async function rotateAccessToken(store: AppStore, session: StoredAuthSession): Promise<StoredAuthSession | null> {
  const user = store.users.find((entry) => entry.id === session.userId);
  if (!user) return null;
  const sessionId = session.id && !session.id.includes("_") ? session.id : createSessionId();
  const refresh = await createRefreshToken(sessionId);
  const access = await issueAccessTokenForUser(user, refresh.sessionId);
  session.id = refresh.sessionId;
  session.accessToken = access.accessToken;
  session.accessFingerprint = access.accessFingerprint;
  session.refreshToken = refresh.refreshToken;
  session.refreshTokenHash = refresh.refreshTokenHash;
  session.accessTokenExpiresAt = access.accessTokenExpiresAt;
  session.refreshTokenExpiresAt = refresh.refreshTokenExpiresAt;
  session.lastUsedAt = new Date().toISOString();
  return session;
}

export async function clearUserSessions(store: AppStore, userId: string): Promise<void> {
  store.authSessions = store.authSessions.map((entry) =>
    entry.userId === userId ? { ...entry, revokedAt: new Date().toISOString() } : entry,
  );
  if (isUserPostgresConfigured()) {
    try {
      await dbClearUserSessions(userId);
    } catch (err) {
      console.error("[auth] DB session revoke failed", err instanceof Error ? err.message : err);
    }
  }
}

export async function resolveTokenToUser(request: Request): Promise<StoredUser | null> {
  const context = await getAuthContext(request);
  if (!context) return null;

  if (isUserPostgresConfigured()) {
    try {
      const dbUser = await dbFindUserById(context.userId);
      if (dbUser && (dbUser.authTokenVersion ?? 0) === context.tokenVersion) {
        return dbUser;
      }
      return null;
    } catch (err) {
      console.error("[auth] DB user hydration failed, falling back to in-memory seed", err instanceof Error ? err.message : err);
    }
  }

  const store = await readStoreAsync();
  return store.users.find((entry) => entry.id === context.userId && (entry.authTokenVersion ?? 0) === context.tokenVersion) ?? null;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; accessFingerprint?: string; refreshToken: string } | null> {
  if (isUserPostgresConfigured()) {
    try {
      const updated = await dbRotateAccessToken(refreshToken);
      if (updated) {
        return {
          accessToken: updated.accessToken,
          accessFingerprint: updated.accessFingerprint,
          refreshToken: updated.refreshToken,
        };
      }
      return null;
    } catch (err) {
      console.error("[auth] DB token rotation failed, falling back to in-memory seed", err instanceof Error ? err.message : err);
    }
  }

  const store = await readStoreAsync();
  const session = await isRefreshTokenValid(store, refreshToken);
  if (!session) return null;
  const updated = await rotateAccessToken(store, session);
  if (!updated) return null;
  return {
    accessToken: updated.accessToken,
    accessFingerprint: updated.accessFingerprint,
    refreshToken: updated.refreshToken,
  };
}

export async function createAuthSessionAsync(store: AppStore, userId: string): Promise<StoredAuthSession> {
  if (isUserPostgresConfigured()) {
    try {
      const session = await dbCreateAuthSession(userId);
      store.authSessions = store.authSessions.filter((s) => s.userId !== userId);
      store.authSessions.push(session);
      return session;
    } catch (err) {
      console.error("[auth] DB session creation failed, falling back to in-memory seed", err instanceof Error ? err.message : err);
    }
  }

  const user = store.users.find((entry) => entry.id === userId);
  if (!user) {
    throw new Error("Cannot create auth session for missing user.");
  }
  const now = Date.now();
  const refresh = await createRefreshToken();
  const access = await issueAccessTokenForUser(user, refresh.sessionId);
  const session: StoredAuthSession = {
    id: refresh.sessionId,
    accessToken: access.accessToken,
    accessFingerprint: access.accessFingerprint,
    refreshToken: refresh.refreshToken,
    refreshTokenHash: refresh.refreshTokenHash,
    userId,
    createdAt: new Date(now).toISOString(),
    accessTokenExpiresAt: access.accessTokenExpiresAt,
    refreshTokenExpiresAt: refresh.refreshTokenExpiresAt,
    revokedAt: null,
    lastUsedAt: null,
    userAgentHash: null,
    ipPrefixHash: null,
  };

  store.authSessions = store.authSessions.filter((entry) => entry.userId !== userId);
  store.authSessions.push(session);
  return session;
}

export async function revokeRefreshSession(refreshToken: string | null | undefined): Promise<void> {
  if (!refreshToken) return;

  if (isUserPostgresConfigured()) {
    try {
      await dbRevokeAuthSessionByRefreshToken(refreshToken);
      return;
    } catch (err) {
      console.error("[auth] DB session revoke failed, falling back to in-memory seed", err instanceof Error ? err.message : err);
    }
  }

  const parsed = parseRefreshToken(refreshToken);
  const store = await readStoreAsync();
  for (const session of store.authSessions) {
    if ((parsed && session.id === parsed.sessionId) || session.refreshToken === refreshToken) {
      session.revokedAt = new Date().toISOString();
    }
  }
}

export { extractAccessToken };
