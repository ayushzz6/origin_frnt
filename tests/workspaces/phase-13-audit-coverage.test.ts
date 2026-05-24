/**
 * Phase 13 — audit-coverage CI guard.
 *
 * Walks every route.ts under /api/teacher, /api/admin, /api/enrollments,
 * and for each POST/PATCH/PUT/DELETE handler verifies the handler
 * transitively reaches a call to `recordAuditEvent`. Transitive search
 * follows `@/server/...` and relative imports up to a depth bound,
 * which catches the typical "route → service → audit" pattern without
 * needing a real type checker.
 *
 * False positives are tolerable per the Phase 13 spec ("grep-based
 * check"). Read-only mutation endpoints (e.g. POST /codes/check, which
 * only reads availability) opt out with a top-of-file marker:
 *
 *     // audit-skip: <one-line reason>
 *
 * Adding routes without recording audit events is a regression — fix
 * the route, or document the read-only nature with the marker above.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const apiRoot = join(repoRoot, "src/app/api");
const srcRoot = join(repoRoot, "src");

const SCANNED_PREFIXES = ["teacher", "admin", "enrollments"];
const MUTATION_HANDLER_RE =
  /^export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\s*\(/m;
const AUDIT_CALL_RE = /\brecordAuditEvent\s*\(/;
const AUDIT_SKIP_RE = /\/\/\s*audit-skip:\s*(.+)$/m;
const IMPORT_RE =
  /from\s+["']((?:@\/[^"']+)|(?:\.{1,2}\/[^"']+))["']/g;

function walkRoutes(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walkRoutes(path));
    else if (path.endsWith("/route.ts")) out.push(path);
  }
  return out;
}

function resolveImport(importer: string, spec: string): string | null {
  let target: string;
  if (spec.startsWith("@/")) {
    target = join(srcRoot, spec.slice(2));
  } else if (spec.startsWith("./") || spec.startsWith("../")) {
    target = resolve(dirname(importer), spec);
  } else {
    return null;
  }
  for (const candidate of [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    `${target}/index.ts`,
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function transitivelyCallsAudit(
  entry: string,
  cache: Map<string, boolean>,
  visiting: Set<string>,
  depth = 0,
): boolean {
  if (cache.has(entry)) return cache.get(entry)!;
  if (visiting.has(entry) || depth > 8) return false;
  visiting.add(entry);
  let source: string;
  try {
    source = readFileSync(entry, "utf8");
  } catch {
    visiting.delete(entry);
    cache.set(entry, false);
    return false;
  }
  if (AUDIT_CALL_RE.test(source)) {
    cache.set(entry, true);
    visiting.delete(entry);
    return true;
  }
  let found = false;
  for (const match of source.matchAll(IMPORT_RE)) {
    const resolved = resolveImport(entry, match[1]);
    if (!resolved) continue;
    if (resolved.includes("/node_modules/")) continue;
    if (transitivelyCallsAudit(resolved, cache, visiting, depth + 1)) {
      found = true;
      break;
    }
  }
  visiting.delete(entry);
  cache.set(entry, found);
  return found;
}

function relativeFromRepo(p: string): string {
  return p.startsWith(repoRoot) ? p.slice(repoRoot.length + 1) : p;
}

test("every mutation route under /api/{teacher,admin,enrollments} writes an audit event", () => {
  const routes = SCANNED_PREFIXES.flatMap((prefix) =>
    walkRoutes(join(apiRoot, prefix)),
  );
  assert.ok(routes.length > 0, "expected to find route.ts files under /api");

  const cache = new Map<string, boolean>();
  const violations: string[] = [];

  for (const route of routes) {
    const source = readFileSync(route, "utf8");
    if (!MUTATION_HANDLER_RE.test(source)) continue;
    if (AUDIT_SKIP_RE.test(source)) continue;
    if (!transitivelyCallsAudit(route, cache, new Set())) {
      violations.push(relativeFromRepo(route));
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Mutation routes that do not transitively call recordAuditEvent ` +
      `(add the call, or annotate with "// audit-skip: <reason>" if read-only):\n` +
      violations.join("\n"),
  );
});
