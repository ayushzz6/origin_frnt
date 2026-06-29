/**
 * Question-Bag-aware DPP question selection (Phase: dppQuestionBank).
 *
 * After a student submits a TEACHER-ASSIGNED test, the auto-DPP generator should
 * prefer the owning workspace's Question Bag for the relevant weak topics and
 * fall back to the OG Code pool the analytics-service already chose. This runs on
 * the USER Postgres pool (where `content.questions` lives) — deliberately NOT in
 * the analytics-service, which only sees the OG Code catalog, and NOT as a
 * cross-DB join (analytics.* and content.* are separate physical DBs).
 *
 * Multi-tenancy: a non-null `workspaceId` is returned ONLY when bag questions are
 * actually used. The caller stamps it on `analytics.dpp_plans.workspace_id`, and
 * the reader (listGeneratedDpps) hides such a plan unless the student still has an
 * ACTIVE enrollment in that workspace — so one teacher's bag never leaks into a
 * DPP shown to a student of another teacher.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

export type DppBagOverride = {
  questionIds: string[];
  /** Non-null only when ≥1 bag question is used (gates tenant visibility). */
  workspaceId: string | null;
  provenanceNote: string;
};

const OG_NOTE = "Generated from the OG Code question pool.";
const BAG_NOTE = "Generated from your institute's Question Bag.";
const MIX_NOTE = "Generated from a mix of your institute's Question Bag and the OG Code pool.";

/**
 * Pure composition of the final DPP question set given the bag matches and the
 * OG Code fallback. Prefers bag questions, tops up from OG Code (deduped), and
 * derives the provenance note + the workspace stamp (non-null ONLY when ≥1 bag
 * question is used — that null/non-null is exactly what gates tenant visibility).
 * Extracted so it can be unit-tested without a database.
 */
export function resolveDppBagSelection(input: {
  bagIds: string[];
  ogcodeQuestionIds: string[];
  targetCount: number;
  workspaceId: string;
}): DppBagOverride {
  if (input.bagIds.length === 0) {
    return { questionIds: input.ogcodeQuestionIds, workspaceId: null, provenanceNote: OG_NOTE };
  }
  const target = Math.max(1, input.targetCount || input.ogcodeQuestionIds.length || input.bagIds.length);
  const seen = new Set(input.bagIds);
  const filler = input.ogcodeQuestionIds.filter((id) => !seen.has(id));
  const questionIds = [...input.bagIds, ...filler].slice(0, target);
  const usedBag = questionIds.filter((id) => seen.has(id)).length;
  return {
    questionIds,
    workspaceId: input.workspaceId,
    provenanceNote: usedBag >= questionIds.length ? BAG_NOTE : MIX_NOTE,
  };
}

export async function selectDppQuestionsWithBagPreference(input: {
  workspaceId: string;
  subject: string;
  weakTopics: string[];
  /** The analytics-service-selected OG Code fallback ids. */
  ogcodeQuestionIds: string[];
  targetCount: number;
  /** Already-attempted question ids to exclude from the DPP. */
  excludeQuestionIds: string[];
}): Promise<DppBagOverride> {
  const fallback: DppBagOverride = {
    questionIds: input.ogcodeQuestionIds,
    workspaceId: null,
    provenanceNote: OG_NOTE,
  };

  if (!isFeatureEnabled("dppQuestionBank")) return fallback;
  if (!isUserPostgresConfigured()) return fallback;
  const pool = getUserPostgresPool();
  if (!pool) return fallback;

  const target = Math.max(1, input.targetCount || input.ogcodeQuestionIds.length || 10);
  const topics = input.weakTopics.map((t) => t.trim()).filter(Boolean);

  const params: unknown[] = [input.workspaceId, input.subject.trim().toLowerCase()];
  let topicClause = "";
  if (topics.length) {
    const start = params.length + 1;
    const ors = topics.map((_, i) => `LOWER(v.concept) LIKE $${start + i} OR LOWER(v.chapter) LIKE $${start + i}`);
    topicClause = ` AND (${ors.join(" OR ")})`;
    params.push(...topics.map((t) => `%${t.toLowerCase()}%`));
  }
  const excludeIdx = params.length + 1;
  params.push(input.excludeQuestionIds);
  const limitIdx = params.length + 1;
  params.push(target);

  const sql = `
    SELECT q.id
    FROM content.questions q
    JOIN content.question_versions v ON v.id = q.current_version_id
    WHERE q.workspace_id = $1
      AND q.status IN ('ready', 'published_private')
      AND LOWER(v.subject) = $2
      ${topicClause}
      AND NOT (q.id = ANY($${excludeIdx}::text[]))
    ORDER BY q.updated_at DESC
    LIMIT $${limitIdx}
  `;

  let bagIds: string[];
  try {
    const res = await pool.query(sql, params);
    bagIds = res.rows.map((r) => String(r.id));
  } catch (error) {
    console.error("selectDppQuestionsWithBagPreference query failed", error);
    return fallback;
  }

  if (bagIds.length === 0) return fallback;

  return resolveDppBagSelection({
    bagIds,
    ogcodeQuestionIds: input.ogcodeQuestionIds,
    targetCount: target,
    workspaceId: input.workspaceId,
  });
}
