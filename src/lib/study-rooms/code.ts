import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_TTL_SECONDS = 180;

export type RoomCodeTokenPayload = {
  room_id: string;
  code_id: string;
  iat: number;
  exp: number;
  v: 1;
};

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value: string): Buffer {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function hmacSha256(input: string, secret: string): string {
  return base64UrlEncode(createHmac("sha256", secret).update(input).digest());
}

export function getRoomCodeSecret(): string {
  const secret = process.env.ROOM_CODE_SECRET?.trim();
  if (!secret) {
    throw new Error("ROOM_CODE_SECRET is not configured.");
  }
  if (secret.length < 32) {
    throw new Error("ROOM_CODE_SECRET must be at least 32 characters.");
  }
  return secret;
}

export function normalizeRoomCode(code: string): string {
  return code.replace(/[\s-]+/g, "").toUpperCase();
}

export function generateRoomCode(length = ROOM_CODE_LENGTH): string {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function hashRoomCode(code: string): string {
  return createHash("sha256").update(normalizeRoomCode(code)).digest("hex");
}

export function signRoomCodeToken(payload: RoomCodeTokenPayload, secret = getRoomCodeSecret()): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  return `${signingInput}.${hmacSha256(signingInput, secret)}`;
}

export function verifyRoomCodeToken(token: string, secret = getRoomCodeSecret(), nowSeconds = Math.floor(Date.now() / 1000)): RoomCodeTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, body, signature] = parts;
  const signingInput = `${header}.${body}`;
  const expectedSignature = hmacSha256(signingInput, secret);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const parsedHeader = JSON.parse(base64UrlDecode(header).toString("utf8")) as { alg?: string };
    if (parsedHeader.alg !== "HS256") {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(body).toString("utf8")) as RoomCodeTokenPayload;
    if (
      payload.v !== 1 ||
      !payload.room_id ||
      !payload.code_id ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      payload.exp <= nowSeconds
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
