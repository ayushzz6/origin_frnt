/**
 * One-time admin setup (run against prod Neon, then it's idempotent):
 *
 *   1. Creates the MAIN admin account for MAIN_ADMIN_EMAIL with role='admin'.
 *      Admin login is OTP-based (handleLoginWithOtp finds the user by email+role,
 *      no password check), so password_hash is unused — but it's NOT NULL, so we
 *      copy it from the same person's existing teacher account.
 *   2. Removes every OTHER role='admin' account (legacy admin@origin.com), so the
 *      only platform admin is MAIN_ADMIN_EMAIL. Falls back to demoting (role →
 *      'student') if a hard delete is blocked by a foreign-key reference.
 *
 * Run:
 *   cd new-frontend
 *   node --env-file=/Users/xyx/Projects/Origin/.env scripts/seed-main-admin.mjs
 *
 * Safe to re-run. Reads USER_DATABASE_URL.
 */

import { Client } from "pg";

const MAIN_ADMIN_EMAIL = (process.env.MAIN_ADMIN_EMAIL || "tohin1400@gmail.com").toLowerCase();
const MAIN_ADMIN_NAME = process.env.MAIN_ADMIN_NAME || "Tohin Admin";
const MAIN_ADMIN_ID = process.env.MAIN_ADMIN_ID || "user_admin_main";

const connectionString = process.env.USER_DATABASE_URL;
if (!connectionString) {
  console.error("USER_DATABASE_URL is not set. Run with --env-file=/Users/xyx/Projects/Origin/.env");
  process.exit(1);
}

const c = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();

  // 1. Source a NOT-NULL-satisfying password_hash from any existing account for
  //    this email (teacher first, then student), since admin login won't use it.
  const src = await c.query(
    `SELECT password_hash, name FROM origin_users
      WHERE LOWER(email) = $1 AND role IN ('teacher','student')
      ORDER BY (role = 'teacher') DESC LIMIT 1`,
    [MAIN_ADMIN_EMAIL],
  );
  const passwordHash = src.rows[0]?.password_hash ?? "otp-only-no-password";

  await c.query(
    `INSERT INTO origin_users (id, name, email, password_hash, role, is_onboarded)
     VALUES ($1, $2, $3, $4, 'admin', true)
     ON CONFLICT (email, role) DO UPDATE SET is_onboarded = true`,
    [MAIN_ADMIN_ID, MAIN_ADMIN_NAME, MAIN_ADMIN_EMAIL, passwordHash],
  );
  console.log(`✓ main admin ensured: ${MAIN_ADMIN_EMAIL}`);

  // 2. Remove all OTHER admins.
  const others = await c.query(
    `SELECT id, email FROM origin_users WHERE role = 'admin' AND LOWER(email) <> $1`,
    [MAIN_ADMIN_EMAIL],
  );
  for (const row of others.rows) {
    try {
      await c.query("DELETE FROM origin_users WHERE id = $1", [row.id]);
      console.log(`✓ deleted legacy admin: ${row.email} (${row.id})`);
    } catch (err) {
      // FK-referenced (created_by / audit etc.) — demote instead of leaving admin.
      await c.query("UPDATE origin_users SET role = 'student' WHERE id = $1", [row.id]);
      console.log(`✓ delete blocked by FK; demoted to student instead: ${row.email} (${row.id}) — ${err.message}`);
    }
  }

  const final = await c.query("SELECT id, name, email, role FROM origin_users WHERE role = 'admin'");
  console.log("Final admins:", JSON.stringify(final.rows, null, 2));
  await c.end();
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
