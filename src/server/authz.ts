import { forbidden, unauthorized } from "@/server/http";
import { AuthServiceUnavailableError } from "@/server/auth-errors";
import { dbFindUserById } from "@/server/db-users";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import { readStoreAsync, type StoredUser } from "@/server/store";
import { verifyRequestAccessJwt, type AccessJwtClaims } from "@/server/auth-jwt";
import {
  requireRoomMembership as requireStoredRoomMembership,
  type ParticipantRole,
} from "@/server/study-rooms";
import { isBearerTokenAuthorized, type ServiceTokenName } from "@/server/service-auth";

export type AuthContext = {
  userId: string;
  sessionId: string;
  role: StoredUser["role"];
  tokenVersion: number;
  jwtId: string;
  claims: AccessJwtClaims;
};

export class AuthzError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function authzErrorResponse(error: unknown): Response {
  if (error instanceof AuthzError) {
    return error.status === 401 ? unauthorized(error.message) : forbidden(error.message);
  }
  return forbidden();
}

export async function getAuthContext(request: Request): Promise<AuthContext | null> {
  try {
    const claims = await verifyRequestAccessJwt(request);
    return {
      userId: claims.sub,
      sessionId: claims.sid,
      role: claims.role,
      tokenVersion: claims.tokenVersion,
      jwtId: claims.jti,
      claims,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(request: Request): Promise<AuthContext> {
  const context = await getAuthContext(request);
  if (!context) {
    throw new AuthzError(401, "Authentication credentials were not provided.");
  }
  return context;
}

export async function requireRole(request: Request, roles: StoredUser["role"][]): Promise<AuthContext> {
  const context = await requireAuth(request);
  if (!roles.includes(context.role)) {
    throw new AuthzError(403, "You do not have permission to perform this action.");
  }
  return context;
}

export async function requireAdmin(request: Request): Promise<AuthContext> {
  return requireRole(request, ["admin"]);
}

export async function requireInternal(request: Request, tokenName: ServiceTokenName = "INTERNAL_CRON_TOKEN"): Promise<void> {
  if (!isBearerTokenAuthorized(request, tokenName)) {
    throw new AuthzError(401, "Invalid internal service token.");
  }
}

export async function getAuthenticatedUser(request: Request): Promise<StoredUser | null> {
  const context = await getAuthContext(request);
  if (!context) {
    return null;
  }

  if (isUserPostgresConfigured()) {
    try {
      const user = await dbFindUserById(context.userId);
      if (!user) {
        return null;
      }
      if ((user.authTokenVersion ?? 0) !== context.tokenVersion) {
        return null;
      }
      return user;
    } catch (error) {
      console.error("[authz] DB user hydration failed", error);
      throw new AuthServiceUnavailableError();
    }
  }

  const store = await readStoreAsync();
  const user = store.users.find((entry) => entry.id === context.userId) ?? null;
  if (user && (user.authTokenVersion ?? 0) === context.tokenVersion) {
    return user;
  }
  return null;
}

export async function requireAuthenticatedUser(request: Request): Promise<StoredUser> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new AuthzError(401, "Authentication credentials were not provided.");
  }
  return user;
}

export async function requireRoomMembership(
  request: Request,
  roomId: string,
  role?: ParticipantRole,
): Promise<AuthContext> {
  const context = await requireAuth(request);
  const participant = await requireStoredRoomMembership(roomId, context.userId);
  if (role && participant.role !== role) {
    throw new AuthzError(403, "You do not have permission to perform this action.");
  }
  return context;
}
