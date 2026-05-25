import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

import pg from "pg";

const { Client } = pg;

const DEFAULT_SEED_PATH = path.resolve(process.cwd(), "data/origin-ai-vector-seed.json.gz");
const DEFAULT_DATABASE_URL = "postgresql://origin:origin123@127.0.0.1:54329/origin_v1_ogcode";
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

const CREATE_VECTOR_TABLES_SQL = `
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE SCHEMA IF NOT EXISTS origin_ai;

  CREATE TABLE IF NOT EXISTS origin_ai.concept_embeddings (
    id UUID PRIMARY KEY,
    concept_name TEXT NOT NULL,
    chapter VARCHAR(255) NOT NULL DEFAULT 'General',
    subject VARCHAR(50) NOT NULL,
    embedding vector(${DEFAULT_EMBEDDING_DIMENSIONS}) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS origin_ai.ogcode_embeddings (
    id UUID PRIMARY KEY,
    question_text TEXT NOT NULL,
    chapter VARCHAR(255) NOT NULL DEFAULT 'General',
    subject VARCHAR(50) NOT NULL,
    explanation TEXT NOT NULL,
    embedding vector(${DEFAULT_EMBEDDING_DIMENSIONS}) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE origin_ai.concept_embeddings
    ADD COLUMN IF NOT EXISTS chapter VARCHAR(255) NOT NULL DEFAULT 'General',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  ALTER TABLE origin_ai.ogcode_embeddings
    ADD COLUMN IF NOT EXISTS chapter VARCHAR(255) NOT NULL DEFAULT 'General',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  CREATE INDEX IF NOT EXISTS idx_concept_emb_subject
    ON origin_ai.concept_embeddings (subject);

  CREATE INDEX IF NOT EXISTS idx_ogcode_emb_subject
    ON origin_ai.ogcode_embeddings (subject);

  CREATE INDEX IF NOT EXISTS idx_concept_emb_hnsw
    ON origin_ai.concept_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

  CREATE INDEX IF NOT EXISTS idx_ogcode_emb_hnsw
    ON origin_ai.ogcode_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
`;

function printUsage() {
  console.log(`Usage:
  npm run origin-ai:vectors:export -- [--out data/origin-ai-vector-seed.json.gz]
  npm run origin-ai:vectors:import -- [--file data/origin-ai-vector-seed.json.gz]
  npm run origin-ai:vectors:import:replace -- [--file data/origin-ai-vector-seed.json.gz]

Environment:
  ORIGIN_AI_DATABASE_URL, OGCODE_DATABASE_URL, POSTGRES_URL, or DATABASE_URL
  Defaults to ${DEFAULT_DATABASE_URL}
`);
}

function parseArgs(argv) {
  if (argv[0] === "--help" || argv[0] === "-h") {
    return {
      command: "help",
      file: DEFAULT_SEED_PATH,
      replace: false,
    };
  }

  const args = {
    command: argv[0],
    file: DEFAULT_SEED_PATH,
    replace: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      args.command = "help";
      continue;
    }
    if (value === "--replace") {
      args.replace = true;
      continue;
    }
    if (value === "--file" || value === "--out") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error(`Missing value for ${value}.`);
      }
      args.file = path.resolve(next);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function normalizeConnectionString(value) {
  if (!value) {
    return DEFAULT_DATABASE_URL;
  }
  return value.replace("postgresql+asyncpg://", "postgresql://");
}

function getConnectionString() {
  return normalizeConnectionString(
    process.env.ORIGIN_AI_DATABASE_URL ??
      process.env.OGCODE_DATABASE_URL ??
      process.env.OGCODE_POSTGRES_URL ??
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL,
  );
}

function getSslConfig(connectionString) {
  try {
    const url = new URL(connectionString);
    return ["localhost", "127.0.0.1"].includes(url.hostname) ? false : { rejectUnauthorized: false };
  } catch {
    return connectionString.includes("localhost") ? false : { rejectUnauthorized: false };
  }
}

async function getClient() {
  const connectionString = getConnectionString();
  const client = new Client({
    connectionString,
    ssl: getSslConfig(connectionString),
  });
  await client.connect();
  return client;
}

function readSeedFile(filePath) {
  const raw = fs.readFileSync(filePath);
  const text = filePath.endsWith(".gz") ? zlib.gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  return JSON.parse(text);
}

function writeSeedFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const text = JSON.stringify(payload, null, 2);
  const data = filePath.endsWith(".gz") ? zlib.gzipSync(text, { level: 9 }) : Buffer.from(text, "utf8");
  fs.writeFileSync(filePath, data);
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'origin_ai' AND table_name = $1
      ) AS exists
    `,
    [tableName],
  );
  return Boolean(result.rows[0]?.exists);
}

async function exportVectors(filePath) {
  const client = await getClient();
  try {
    await client.query(CREATE_VECTOR_TABLES_SQL);
    const hasConcepts = await tableExists(client, "concept_embeddings");
    const hasOgcode = await tableExists(client, "ogcode_embeddings");
    const conceptRows = hasConcepts
      ? (
          await client.query(`
            SELECT id::text, concept_name, chapter, subject, embedding::text AS embedding,
                   created_at::text, updated_at::text
            FROM origin_ai.concept_embeddings
            ORDER BY subject, chapter, concept_name, id
          `)
        ).rows
      : [];
    const ogcodeRows = hasOgcode
      ? (
          await client.query(`
            SELECT id::text, question_text, chapter, subject, explanation, embedding::text AS embedding,
                   created_at::text, updated_at::text
            FROM origin_ai.ogcode_embeddings
            ORDER BY subject, chapter, question_text, id
          `)
        ).rows
      : [];

    const payload = {
      format: "origin-ai-vector-seed",
      version: 1,
      embeddingDimensions: DEFAULT_EMBEDDING_DIMENSIONS,
      exportedAt: new Date().toISOString(),
      counts: {
        conceptEmbeddings: conceptRows.length,
        ogcodeEmbeddings: ogcodeRows.length,
      },
      conceptEmbeddings: conceptRows,
      ogcodeEmbeddings: ogcodeRows,
    };

    writeSeedFile(filePath, payload);
    console.log(
      `Exported ${conceptRows.length} concept embeddings and ${ogcodeRows.length} OGCode embeddings to ${filePath}`,
    );
    if (!conceptRows.length || !ogcodeRows.length) {
      console.warn("Warning: one or both vector tables are empty. Seed with a valid Gemini embedding key before sharing.");
    }
  } finally {
    await client.end();
  }
}

function assertSeedPayload(payload) {
  if (payload?.format !== "origin-ai-vector-seed" || payload.version !== 1) {
    throw new Error("Unsupported vector seed file format.");
  }
  if (payload.embeddingDimensions !== DEFAULT_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimensions mismatch. Expected ${DEFAULT_EMBEDDING_DIMENSIONS}, got ${payload.embeddingDimensions}.`,
    );
  }
  if (!Array.isArray(payload.conceptEmbeddings) || !Array.isArray(payload.ogcodeEmbeddings)) {
    throw new Error("Vector seed file is missing embedding arrays.");
  }
}

async function insertConceptRows(client, rows) {
  const sql = `
    INSERT INTO origin_ai.concept_embeddings
      (id, concept_name, chapter, subject, embedding, created_at, updated_at)
    SELECT
      id,
      concept_name,
      COALESCE(NULLIF(chapter, ''), 'General'),
      subject,
      embedding::vector,
      COALESCE(created_at, NOW()),
      COALESCE(updated_at, NOW())
    FROM jsonb_to_recordset($1::jsonb) AS row(
      id UUID,
      concept_name TEXT,
      chapter TEXT,
      subject TEXT,
      embedding TEXT,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    )
    ON CONFLICT (id) DO UPDATE SET
      concept_name = EXCLUDED.concept_name,
      chapter = EXCLUDED.chapter,
      subject = EXCLUDED.subject,
      embedding = EXCLUDED.embedding,
      updated_at = EXCLUDED.updated_at
  `;

  const batchSize = 100;
  for (let start = 0; start < rows.length; start += batchSize) {
    await client.query(sql, [JSON.stringify(rows.slice(start, start + batchSize))]);
  }
}

async function insertOgcodeRows(client, rows) {
  const sql = `
    INSERT INTO origin_ai.ogcode_embeddings
      (id, question_text, chapter, subject, explanation, embedding, created_at, updated_at)
    SELECT
      id,
      question_text,
      COALESCE(NULLIF(chapter, ''), 'General'),
      subject,
      explanation,
      embedding::vector,
      COALESCE(created_at, NOW()),
      COALESCE(updated_at, NOW())
    FROM jsonb_to_recordset($1::jsonb) AS row(
      id UUID,
      question_text TEXT,
      chapter TEXT,
      subject TEXT,
      explanation TEXT,
      embedding TEXT,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    )
    ON CONFLICT (id) DO UPDATE SET
      question_text = EXCLUDED.question_text,
      chapter = EXCLUDED.chapter,
      subject = EXCLUDED.subject,
      explanation = EXCLUDED.explanation,
      embedding = EXCLUDED.embedding,
      updated_at = EXCLUDED.updated_at
  `;

  const batchSize = 100;
  for (let start = 0; start < rows.length; start += batchSize) {
    await client.query(sql, [JSON.stringify(rows.slice(start, start + batchSize))]);
  }
}

async function importVectors(filePath, options) {
  const payload = readSeedFile(filePath);
  assertSeedPayload(payload);

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(CREATE_VECTOR_TABLES_SQL);

    if (options.replace) {
      await client.query("TRUNCATE origin_ai.concept_embeddings, origin_ai.ogcode_embeddings");
    }

    await insertConceptRows(client, payload.conceptEmbeddings);
    await insertOgcodeRows(client, payload.ogcodeEmbeddings);
    await client.query("COMMIT");

    console.log(
      `Imported ${payload.conceptEmbeddings.length} concept embeddings and ${payload.ogcodeEmbeddings.length} OGCode embeddings from ${filePath}`,
    );
    console.log("Restart origin-ai after importing so the chapter cache rebuilds from the restored vectors.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "help" || !args.command) {
    printUsage();
    return;
  }
  if (args.command === "export") {
    await exportVectors(args.file);
    return;
  }
  if (args.command === "import") {
    await importVectors(args.file, { replace: args.replace });
    return;
  }
  throw new Error(`Unknown command: ${args.command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
