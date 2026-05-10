import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

import {
  AUTH_JWT_AUDIENCE,
  AUTH_JWT_ISSUER,
  COOKIE_OPTS_ACCESS,
  COOKIE_OPTS_ACCESS_FINGERPRINT,
  COOKIE_OPTS_CSRF,
  COOKIE_OPTS_REFRESH,
  createRefreshToken,
  createSessionId,
  hashAccessFingerprint,
  hashRefreshTokenSecret,
  issueAccessTokenForUser,
  parseRefreshToken,
  verifyAccessJwt,
} from "../src/server/auth-jwt";
import { createAuthSessionAsync, isRefreshTokenValid, rotateAccessToken } from "../src/server/auth";
import { resetStore, withStoredUserDefaults, type StoredUser } from "../src/server/store";

process.env.AUTH_JWT_SECRET_CURRENT = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";

const secret = new TextEncoder().encode("0123456789abcdef0123456789abcdef");

function buildUser(patch: Partial<StoredUser> = {}): StoredUser {
  return withStoredUserDefaults({
    id: "user_1",
    name: "Test User",
    email: "test@example.com",
    password: "",
    role: "student",
    studentClass: null,
    fieldOfInterest: null,
    referralSource: null,
    avatar: null,
    streak: 0,
    totalStudyTime: 0,
    joinedAt: new Date(0).toISOString(),
    isPremium: false,
    premiumExpiry: null,
    isOnboarded: false,
    selectedCourse: null,
    isDropper: false,
    yearsOfExperience: null,
    subjects: [],
    studentCapacity: null,
    ...patch,
  });
}

async function signToken(
  payloadPatch: Record<string, unknown>,
  {
    alg = "HS256",
    typ = "JWT",
    fingerprint = "fingerprint_1",
  }: { alg?: "HS256" | "HS384"; typ?: string; fingerprint?: string } = {},
): Promise<{ token: string; fingerprint: string }> {
  const now = Math.floor(Date.now() / 1000);
  const fgpHash = await hashAccessFingerprint(fingerprint);
  const payload = {
    sid: "session_1",
    role: "student",
    tokenVersion: 0,
    fgpHash,
    ...payloadPatch,
  };
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg, typ })
    .setIssuer(AUTH_JWT_ISSUER)
    .setAudience(AUTH_JWT_AUDIENCE)
    .setSubject("user_1")
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 600)
    .setJti("jwt_1")
    .sign(secret);
  return { token, fingerprint };
}

test("access JWT verifies with the matching fingerprint", async () => {
  const user = buildUser({ authTokenVersion: 3 });
  const issued = await issueAccessTokenForUser(user, "session_1");
  const claims = await verifyAccessJwt(issued.accessToken, issued.accessFingerprint);

  assert.equal(claims.sub, user.id);
  assert.equal(claims.sid, "session_1");
  assert.equal(claims.role, "student");
  assert.equal(claims.tokenVersion, 3);
});

test("access JWT rejects wrong alg, issuer, audience, expiry, future nbf, missing sid, and fingerprint failures", async () => {
  const wrongAlg = await signToken({}, { alg: "HS384" });
  await assert.rejects(() => verifyAccessJwt(wrongAlg.token, wrongAlg.fingerprint));

  const wrongIssuer = await new SignJWT({
    sid: "session_1",
    role: "student",
    tokenVersion: 0,
    fgpHash: await hashAccessFingerprint("fingerprint_1"),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("other")
    .setAudience(AUTH_JWT_AUDIENCE)
    .setSubject("user_1")
    .setIssuedAt()
    .setNotBefore(0)
    .setExpirationTime("10 min")
    .setJti("jwt_issuer")
    .sign(secret);
  await assert.rejects(() => verifyAccessJwt(wrongIssuer, "fingerprint_1"));

  const wrongAudience = await new SignJWT({
    sid: "session_1",
    role: "student",
    tokenVersion: 0,
    fgpHash: await hashAccessFingerprint("fingerprint_1"),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(AUTH_JWT_ISSUER)
    .setAudience("other")
    .setSubject("user_1")
    .setIssuedAt()
    .setNotBefore(0)
    .setExpirationTime("10 min")
    .setJti("jwt_audience")
    .sign(secret);
  await assert.rejects(() => verifyAccessJwt(wrongAudience, "fingerprint_1"));

  const expired = await new SignJWT({
    sid: "session_1",
    role: "student",
    tokenVersion: 0,
    fgpHash: await hashAccessFingerprint("fingerprint_1"),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(AUTH_JWT_ISSUER)
    .setAudience(AUTH_JWT_AUDIENCE)
    .setSubject("user_1")
    .setIssuedAt(1)
    .setNotBefore(1)
    .setExpirationTime(2)
    .setJti("jwt_expired")
    .sign(secret);
  await assert.rejects(() => verifyAccessJwt(expired, "fingerprint_1"));

  const futureNbf = await new SignJWT({
    sid: "session_1",
    role: "student",
    tokenVersion: 0,
    fgpHash: await hashAccessFingerprint("fingerprint_1"),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(AUTH_JWT_ISSUER)
    .setAudience(AUTH_JWT_AUDIENCE)
    .setSubject("user_1")
    .setIssuedAt()
    .setNotBefore(Math.floor(Date.now() / 1000) + 3600)
    .setExpirationTime("2 h")
    .setJti("jwt_nbf")
    .sign(secret);
  await assert.rejects(() => verifyAccessJwt(futureNbf, "fingerprint_1"));

  const missingSid = await signToken({ sid: undefined });
  await assert.rejects(() => verifyAccessJwt(missingSid.token, missingSid.fingerprint));
  await assert.rejects(() => verifyAccessJwt(missingSid.token, null));
  await assert.rejects(() => verifyAccessJwt(missingSid.token, "wrong_fingerprint"));
});

test("refresh tokens expose only the session id and a hashed random secret", async () => {
  const issued = await createRefreshToken("session1");
  assert.match(issued.refreshToken, /^rt_session1_/);

  const parsed = parseRefreshToken(issued.refreshToken);
  assert.ok(parsed);
  assert.equal(parsed.sessionId, "session1");
  assert.equal(await hashRefreshTokenSecret(parsed.secret), issued.refreshTokenHash);
  assert.equal(parseRefreshToken("refresh_legacy"), null);
  await assert.rejects(() => createRefreshToken("session_1"));
  assert.doesNotMatch(createSessionId(), /_/);
});

test("refresh rotation rejects replay and revokes the session", async () => {
  const previousDatabaseUrl = process.env.USER_DATABASE_URL;
  delete process.env.USER_DATABASE_URL;
  try {
    const store = resetStore();
    const user = store.users[0];
    const session = await createAuthSessionAsync(store, user.id);
    const oldRefreshToken = session.refreshToken;

    const rotated = await rotateAccessToken(store, session);
    assert.ok(rotated);
    assert.notEqual(rotated.refreshToken, oldRefreshToken);

    assert.equal(await isRefreshTokenValid(store, oldRefreshToken), null);
    assert.ok(session.revokedAt);
  } finally {
    if (previousDatabaseUrl) {
      process.env.USER_DATABASE_URL = previousDatabaseUrl;
    }
  }
});

test("auth cookie flags use short access TTL and strict refresh SameSite", () => {
  assert.deepEqual(COOKIE_OPTS_ACCESS, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  assert.deepEqual(COOKIE_OPTS_ACCESS_FINGERPRINT, COOKIE_OPTS_ACCESS);
  assert.equal(COOKIE_OPTS_REFRESH.httpOnly, true);
  assert.equal(COOKIE_OPTS_REFRESH.sameSite, "strict");
  assert.equal(COOKIE_OPTS_REFRESH.maxAge, 604800);
  assert.equal(COOKIE_OPTS_CSRF.httpOnly, false);
  assert.equal(COOKIE_OPTS_CSRF.sameSite, "lax");
});
