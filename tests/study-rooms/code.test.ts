import test from "node:test";
import assert from "node:assert/strict";

import {
  generateRoomCode,
  hashRoomCode,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  signRoomCodeToken,
  verifyRoomCodeToken,
} from "../../src/lib/study-rooms/code";

const SECRET = "12345678901234567890123456789012";

test("generateRoomCode uses the unambiguous Crockford alphabet", () => {
  for (let index = 0; index < 100; index += 1) {
    const code = generateRoomCode();
    assert.equal(code.length, 6);
    for (const char of code) {
      assert.ok(ROOM_CODE_ALPHABET.includes(char), `unexpected char ${char}`);
    }
  }
});

test("normalizeRoomCode strips spacing and uppercases input", () => {
  assert.equal(normalizeRoomCode(" kq7 b2n "), "KQ7B2N");
  assert.equal(normalizeRoomCode("kq7-b2n"), "KQ7B2N");
});

test("room code token verifies and rejects tampering", () => {
  const token = signRoomCodeToken(
    {
      room_id: "room_abc",
      code_id: "code_abc",
      iat: 10,
      exp: 100,
      v: 1,
    },
    SECRET,
  );

  assert.deepEqual(verifyRoomCodeToken(token, SECRET, 20), {
    room_id: "room_abc",
    code_id: "code_abc",
    iat: 10,
    exp: 100,
    v: 1,
  });

  assert.equal(verifyRoomCodeToken(`${token.slice(0, -1)}x`, SECRET, 20), null);
});

test("room code token rejects expired payloads", () => {
  const token = signRoomCodeToken(
    {
      room_id: "room_abc",
      code_id: "code_abc",
      iat: 10,
      exp: 20,
      v: 1,
    },
    SECRET,
  );

  assert.equal(verifyRoomCodeToken(token, SECRET, 21), null);
});

test("hashRoomCode is normalized before hashing", () => {
  assert.equal(hashRoomCode("kq7-b2n"), hashRoomCode("KQ7B2N"));
});
