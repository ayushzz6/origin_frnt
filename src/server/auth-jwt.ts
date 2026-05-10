import { jwtVerify, SignJWT, type JWTPayload } from "jose";

import type { StoredUser } from "@/server/store";

export const ACCESS_COOKIE_NAME = "origin_access_token";
export const ACCESS_FINGERPRINT_COOKIE_NAME = "origin_access_fgp";
export const REFRESH_COOKIE_NAME = "origin_refresh_token";
export const CSRF_COOKIE_NAME = "origin_csrf";

export const AUTH_JWT_ISSUER = "origin-v1";
export const AUTH_JWT_AUDIENCE = "origin-web";
export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const COOKIE_OPTS_ACCESS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ACCESS_TOKEN_TTL_SECONDS,
};

export const COOKIE_OPTS_ACCESS_FINGERPRINT = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ACCESS_TOKEN_TTL_SECONDS,
};

export const COOKIE_OPTS_REFRESH = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: REFRESH_TOKEN_TTL_SECONDS,
};

export const COOKIE_OPTS_CSRF = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ACCESS_TOKEN_TTL_SECONDS,
};

export type AccessJwtClaims = JWTPayload & {
  sub: string;
  sid: string;
  role: StoredUser["role"];
  tokenVersion: number;
  fgpHash: string;
  iss: typeof AUTH_JWT_ISSUER;
  aud: typeof AUTH_JWT_AUDIENCE;
  iat: number;
  nbf: number;
  exp: number;
  jti: string;
};

export type AccessTokenIssue = {
  accessToken: string;
  accessFingerprint: string;
  accessTokenExpiresAt: string;
};

export type RefreshTokenIssue = {
  sessionId: string;
  refreshToken: string;
  refreshTokenHash: string;
  refreshTokenExpiresAt: string;
};

export type ParsedRefreshToken = {
  sessionId: string;
  secret: string;
};

function cryptoApi(): Crypto {
  const api = globalThis.crypto;
  if (!api?.subtle) {
    throw new Error("Web Crypto is required for auth token operations.");
  }
  return api;
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  cryptoApi().getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  cryptoApi().getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await cryptoApi().subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function readSecret(name: "AUTH_JWT_SECRET_CURRENT" | "AUTH_JWT_SECRET_PREVIOUS"): Uint8Array | null {
  const raw = process.env[name]?.trim();
  if (!raw) {
    if (name === "AUTH_JWT_SECRET_CURRENT") {
      throw new Error(`${name} must be set to a 32+ byte base64url secret.`);
    }
    return null;
  }
  const bytes = base64UrlToBytes(raw);
  if (bytes.length < 32) {
    throw new Error(`${name} must decode to at least 32 bytes.`);
  }
  return bytes;
}

function currentSecret(): Uint8Array {
  const secret = readSecret("AUTH_JWT_SECRET_CURRENT");
  if (!secret) {
    throw new Error("AUTH_JWT_SECRET_CURRENT is required.");
  }
  return secret;
}

function previousSecret(): Uint8Array | null {
  return readSecret("AUTH_JWT_SECRET_PREVIOUS");
}

function assertAccessClaims(payload: JWTPayload): asserts payload is AccessJwtClaims {
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Access JWT is missing sub.");
  }
  if (typeof payload.sid !== "string" || payload.sid.length === 0) {
    throw new Error("Access JWT is missing sid.");
  }
  if (payload.role !== "student" && payload.role !== "teacher" && payload.role !== "admin") {
    throw new Error("Access JWT has an invalid role.");
  }
  if (!Number.isInteger(payload.tokenVersion)) {
    throw new Error("Access JWT is missing tokenVersion.");
  }
  if (typeof payload.fgpHash !== "string" || payload.fgpHash.length === 0) {
    throw new Error("Access JWT is missing fgpHash.");
  }
  if (payload.iss !== AUTH_JWT_ISSUER || payload.aud !== AUTH_JWT_AUDIENCE) {
    throw new Error("Access JWT has invalid issuer or audience.");
  }
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.nbf) || !Number.isInteger(payload.exp)) {
    throw new Error("Access JWT is missing time claims.");
  }
  if (typeof payload.jti !== "string" || payload.jti.length === 0) {
    throw new Error("Access JWT is missing jti.");
  }
}

export async function hashAccessFingerprint(fingerprint: string): Promise<string> {
  return sha256Base64Url(fingerprint);
}

export async function hashRefreshTokenSecret(secret: string): Promise<string> {
  return sha256Base64Url(secret);
}

export function createSessionId(): string {
  return randomHex(24);
}

export async function createRefreshToken(sessionId = createSessionId()): Promise<RefreshTokenIssue> {
  if (sessionId.includes("_")) {
    throw new Error("Refresh-token session IDs must not contain underscores.");
  }
  const secret = randomBase64Url(32);
  return {
    sessionId,
    refreshToken: `rt_${sessionId}_${secret}`,
    refreshTokenHash: await hashRefreshTokenSecret(secret),
    refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
  };
}

export function parseRefreshToken(refreshToken: string): ParsedRefreshToken | null {
  if (!refreshToken.startsWith("rt_")) {
    return null;
  }
  const rest = refreshToken.slice(3);
  const separator = rest.indexOf("_");
  if (separator <= 0 || separator === rest.length - 1) {
    return null;
  }
  return {
    sessionId: rest.slice(0, separator),
    secret: rest.slice(separator + 1),
  };
}

export async function issueAccessTokenForUser(user: StoredUser, sessionId: string): Promise<AccessTokenIssue> {
  const now = Math.floor(Date.now() / 1000);
  const accessFingerprint = randomBase64Url(32);
  const fgpHash = await hashAccessFingerprint(accessFingerprint);
  const accessToken = await new SignJWT({
    sid: sessionId,
    role: user.role,
    tokenVersion: user.authTokenVersion ?? 0,
    fgpHash,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(AUTH_JWT_ISSUER)
    .setAudience(AUTH_JWT_AUDIENCE)
    .setSubject(user.id)
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .setJti(randomBase64Url(16))
    .sign(currentSecret());

  return {
    accessToken,
    accessFingerprint,
    accessTokenExpiresAt: new Date((now + ACCESS_TOKEN_TTL_SECONDS) * 1000).toISOString(),
  };
}

export async function verifyAccessJwt(accessToken: string, accessFingerprint: string | null): Promise<AccessJwtClaims> {
  if (!accessFingerprint) {
    throw new Error("Access fingerprint cookie is required.");
  }

  const secrets = [currentSecret(), previousSecret()].filter((secret): secret is Uint8Array => Boolean(secret));
  let lastError: unknown = null;
  for (const secret of secrets) {
    try {
      const { payload, protectedHeader } = await jwtVerify(accessToken, secret, {
        algorithms: ["HS256"],
        issuer: AUTH_JWT_ISSUER,
        audience: AUTH_JWT_AUDIENCE,
        typ: "JWT",
      });
      if (protectedHeader.alg !== "HS256" || protectedHeader.typ !== "JWT") {
        throw new Error("Access JWT has invalid protected header.");
      }
      assertAccessClaims(payload);
      const actualFingerprintHash = await hashAccessFingerprint(accessFingerprint);
      if (payload.fgpHash !== actualFingerprintHash) {
        throw new Error("Access fingerprint mismatch.");
      }
      return payload;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Access JWT verification failed.");
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === name) {
      const value = rawValue.join("=");
      return value ? decodeURIComponent(value) : null;
    }
  }
  return null;
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}

export function extractAccessToken(request: Request): string | null {
  return extractBearerToken(request) ?? readCookie(request, ACCESS_COOKIE_NAME);
}

export function extractAccessFingerprint(request: Request): string | null {
  return readCookie(request, ACCESS_FINGERPRINT_COOKIE_NAME);
}

export function extractRefreshToken(request: Request): string | null {
  return readCookie(request, REFRESH_COOKIE_NAME);
}

export async function verifyRequestAccessJwt(request: Request): Promise<AccessJwtClaims> {
  const token = extractAccessToken(request);
  if (!token) {
    throw new Error("Access token is required.");
  }
  return verifyAccessJwt(token, extractAccessFingerprint(request));
}

export function createCsrfToken(): string {
  return randomBase64Url(32);
}
