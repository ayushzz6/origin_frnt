/**
 * NCERT book catalog — dual-source implementation.
 *
 * Development (no USER_DATABASE_URL):
 *   Returns the hardcoded `ncertBooksData` from src/data/ncertBooks.ts.
 *   Zero config needed; local PDF files under /public/books/ work as-is.
 *
 * Production (USER_DATABASE_URL / Neon configured):
 *   Reads from `origin_ncert_books` + `origin_ncert_chapters` tables.
 *   On first boot the tables are created and seeded from the hardcoded data,
 *   so the app works immediately without a separate migration step.
 *   After that the DB is the source of truth — books/chapters can be added,
 *   edited, or removed via admin without redeploying.
 */

import { ncertBooksData } from "@/data/ncertBooks";
import type { NCERTBook } from "@/data/ncertBooks";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

// ─── Schema ──────────────────────────────────────────────────────────────────

let schemaReady = false;

async function ensureNcertSchema(): Promise<void> {
  if (schemaReady) return;
  const pool = getUserPostgresPool()!;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS origin_ncert_books (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      book_class      TEXT NOT NULL,
      subject         TEXT NOT NULL,
      code            TEXT NOT NULL DEFAULT '',
      base_path       TEXT,
      total_chapters  INTEGER,
      sort_order      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS origin_ncert_chapters (
      id          TEXT NOT NULL,
      book_id     TEXT NOT NULL REFERENCES origin_ncert_books(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      pdf_file    TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (id, book_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ncert_chapters_book ON origin_ncert_chapters (book_id, sort_order);
  `);
  schemaReady = true;
}

// ─── Seeding ─────────────────────────────────────────────────────────────────

async function seedIfEmpty(): Promise<void> {
  const pool = getUserPostgresPool()!;
  const { rows } = await pool.query("SELECT 1 FROM origin_ncert_books LIMIT 1");
  if (rows.length > 0) return; // already seeded

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let bi = 0; bi < ncertBooksData.length; bi++) {
      const book = ncertBooksData[bi];
      await client.query(
        `INSERT INTO origin_ncert_books
           (id, title, book_class, subject, code, base_path, total_chapters, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [book.id, book.title, book.bookClass, book.subject,
         book.code ?? "", book.basePath ?? null,
         book.totalChapters ?? null, bi],
      );
      const chapters = book.chapters ?? [];
      for (let ci = 0; ci < chapters.length; ci++) {
        const ch = chapters[ci];
        await client.query(
          `INSERT INTO origin_ncert_chapters (id, book_id, title, pdf_file, sort_order)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (id, book_id) DO NOTHING`,
          [ch.id, book.id, ch.title, ch.pdfFile ?? null, ci],
        );
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the full NCERT book catalog with chapters.
 *
 * In development (no DB): uses the hardcoded TypeScript file.
 * In production (Neon configured): queries the DB, auto-seeding on first call.
 */
export async function getNcertCatalog(): Promise<NCERTBook[]> {
  if (!isUserPostgresConfigured()) {
    return ncertBooksData;
  }

  try {
    await ensureNcertSchema();
    await seedIfEmpty();

    const pool = getUserPostgresPool()!;
    const [booksResult, chaptersResult] = await Promise.all([
      pool.query("SELECT * FROM origin_ncert_books ORDER BY sort_order"),
      pool.query("SELECT * FROM origin_ncert_chapters ORDER BY book_id, sort_order"),
    ]);

    const chaptersByBook = new Map<string, NCERTBook["chapters"]>();
    for (const row of chaptersResult.rows) {
      const list = chaptersByBook.get(row.book_id) ?? [];
      list.push({ id: row.id, title: row.title, pdfFile: row.pdf_file ?? undefined });
      chaptersByBook.set(row.book_id, list);
    }

    return booksResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      bookClass: row.book_class,
      subject: row.subject,
      code: row.code,
      basePath: row.base_path ?? undefined,
      totalChapters: row.total_chapters ?? undefined,
      chapters: chaptersByBook.get(row.id) ?? [],
    }));
  } catch (err) {
    console.error("[study-catalog] DB read failed, falling back to hardcoded data:", err);
    return ncertBooksData;
  }
}

/**
 * Derives the ordered list of unique class values from a catalog.
 * Matches the shape of the hardcoded `ncertClasses` export.
 */
export function deriveClasses(catalog: NCERTBook[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of catalog) {
    if (!seen.has(b.bookClass)) {
      seen.add(b.bookClass);
      out.push(b.bookClass);
    }
  }
  // Sort descending (Class 12 before 11) to match expected UI order
  return out.sort((a, b) => Number(b) - Number(a));
}

/**
 * Derives the subject map per class from a catalog.
 * Matches the shape of the hardcoded `ncertSubjectsByClass` export.
 */
export function deriveSubjectsByClass(catalog: NCERTBook[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const b of catalog) {
    if (!map[b.bookClass]) map[b.bookClass] = [];
    if (!map[b.bookClass].includes(b.subject)) {
      map[b.bookClass].push(b.subject);
    }
  }
  return map;
}
