/**
 * Teacher-facing OG Code browse (Phase 15).
 *
 * Reuses the ungated catalog primitives (`listOgcodeCatalogQuestionPage`,
 * `listOgcodeCatalogChapters`) so a teacher sees the FULL bank — never the student
 * premium gate / 500 free-sample clamp / attempt-state (those live in
 * `assessments.ts`, which this path deliberately bypasses). The list payload is
 * answer-free (stem + options + metadata only): teachers select by id, and the
 * correct answer is resolved server-side at take/grade time.
 */

import {
  listOgcodeCatalogChapters,
  listOgcodeCatalogQuestionPage,
} from "@/server/ogcode-catalog";
import type { StoredQuestion } from "@/legacy/store";

export type OgcodeBrowseItem = {
  id: string;
  text: string;
  options: string[] | null;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: string;
  questionType: string;
  tags: string[] | string | null;
};

export type OgcodeBrowsePage = {
  items: OgcodeBrowseItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type OgcodeBrowseFilters = {
  subject?: string | null;
  difficulty?: string | null;
  type?: string | null;
  search?: string | null;
  chapters?: string[] | null;
  excludeIds?: string[] | null;
  limit: number;
  offset: number;
};

function toBrowseItem(q: StoredQuestion): OgcodeBrowseItem {
  return {
    id: q.id,
    text: q.text,
    options: q.options,
    subject: q.subject,
    chapter: q.chapter,
    concept: q.concept,
    difficulty: q.difficulty,
    questionType: q.questionType,
    tags: q.tags,
  };
}

export async function listOgcodeBrowsePage(filters: OgcodeBrowseFilters): Promise<OgcodeBrowsePage> {
  const { items, total } = await listOgcodeCatalogQuestionPage({
    subject: filters.subject ?? null,
    difficulty: filters.difficulty ?? null,
    type: filters.type ?? null,
    search: filters.search ?? null,
    chapters: filters.chapters ?? null,
    excludeIds: filters.excludeIds ?? null,
    limit: filters.limit,
    offset: filters.offset,
  });
  return {
    items: items.map(toBrowseItem),
    total,
    limit: filters.limit,
    offset: filters.offset,
    hasMore: filters.offset + items.length < total,
  };
}

export async function listOgcodeBrowseChapters(subject: string): Promise<string[]> {
  if (!subject) return [];
  return listOgcodeCatalogChapters(subject);
}
