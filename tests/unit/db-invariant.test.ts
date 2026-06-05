/**
 * Phase 14 (2E) — same-physical-DB invariant guard. Pure env-driven logic, so it
 * runs in test:unit without a database.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { isSamePhysicalDatabase } from "@/server/db-invariant";

const USER = process.env.USER_DATABASE_URL;
const OG = process.env.OGCODE_DATABASE_URL;
const OGP = process.env.OGCODE_POSTGRES_URL;
const PG = process.env.POSTGRES_URL;
const DB = process.env.DATABASE_URL;

function setEnv(user: string | undefined, ogcode: string | undefined): void {
  // Clear every DSN source the resolvers consult so each case is isolated.
  for (const key of ["USER_DATABASE_URL", "OGCODE_DATABASE_URL", "OGCODE_POSTGRES_URL", "POSTGRES_URL", "DATABASE_URL"]) {
    delete process.env[key];
  }
  if (user) process.env.USER_DATABASE_URL = user;
  if (ogcode) process.env.OGCODE_DATABASE_URL = ogcode;
}

function restoreEnv(): void {
  const restore: Record<string, string | undefined> = {
    USER_DATABASE_URL: USER,
    OGCODE_DATABASE_URL: OG,
    OGCODE_POSTGRES_URL: OGP,
    POSTGRES_URL: PG,
    DATABASE_URL: DB,
  };
  for (const [key, value] of Object.entries(restore)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("isSamePhysicalDatabase: identical DSNs are the same DB", () => {
  try {
    const dsn = "postgres://u:p@db.neon.tech:5432/origin?sslmode=require";
    setEnv(dsn, dsn);
    assert.equal(isSamePhysicalDatabase(), true);
  } finally {
    restoreEnv();
  }
});

test("isSamePhysicalDatabase: same host+db with different query params is the same DB", () => {
  try {
    setEnv(
      "postgres://u:p@db.neon.tech:5432/origin?sslmode=require",
      "postgres://u:p@db.neon.tech/origin?sslmode=disable&pool=1",
    );
    assert.equal(isSamePhysicalDatabase(), true);
  } finally {
    restoreEnv();
  }
});

test("isSamePhysicalDatabase: different host is a split deployment", () => {
  try {
    setEnv(
      "postgres://u:p@user.neon.tech:5432/origin",
      "postgres://u:p@ogcode.neon.tech:5432/origin",
    );
    assert.equal(isSamePhysicalDatabase(), false);
  } finally {
    restoreEnv();
  }
});

test("isSamePhysicalDatabase: same host different database is split", () => {
  try {
    setEnv(
      "postgres://u:p@db.neon.tech:5432/origin_user",
      "postgres://u:p@db.neon.tech:5432/origin_ogcode",
    );
    assert.equal(isSamePhysicalDatabase(), false);
  } finally {
    restoreEnv();
  }
});

test("isSamePhysicalDatabase: a single configured pool conservatively passes", () => {
  try {
    setEnv("postgres://u:p@db.neon.tech:5432/origin", undefined);
    assert.equal(isSamePhysicalDatabase(), true);
  } finally {
    restoreEnv();
  }
});
