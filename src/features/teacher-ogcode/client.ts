/**
 * Browser client for the teacher OG Code browse API (Phase 15). Shared by the
 * read-only OG Code section and the test-builder's OG Code source tab.
 */

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

export type OgcodeBrowseParams = {
  subject?: string | null;
  difficulty?: string | null;
  type?: string | null;
  search?: string | null;
  chapters?: string[] | null;
  excludeIds?: string[] | null;
  limit: number;
  offset: number;
};

function buildQuery(params: OgcodeBrowseParams): string {
  const qs = new URLSearchParams();
  if (params.subject) qs.set("subject", params.subject);
  if (params.difficulty) qs.set("difficulty", params.difficulty);
  if (params.type) qs.set("type", params.type);
  if (params.search) qs.set("search", params.search);
  for (const c of params.chapters ?? []) qs.append("chapters", c);
  if (params.excludeIds && params.excludeIds.length) qs.set("excludeIds", params.excludeIds.join(","));
  qs.set("limit", String(params.limit));
  qs.set("offset", String(params.offset));
  return qs.toString();
}

export async function fetchOgcodeBrowsePage(
  workspaceId: string,
  params: OgcodeBrowseParams,
): Promise<OgcodeBrowsePage> {
  const res = await fetch(
    `/api/teacher/workspaces/${encodeURIComponent(workspaceId)}/ogcode?${buildQuery(params)}`,
    { method: "GET", credentials: "include" },
  );
  if (!res.ok) throw new Error(`OG Code load failed (${res.status})`);
  return (await res.json()) as OgcodeBrowsePage;
}

export async function fetchOgcodeChapters(workspaceId: string, subject: string): Promise<string[]> {
  if (!subject) return [];
  const qs = new URLSearchParams({ meta: "chapters", subject });
  const res = await fetch(
    `/api/teacher/workspaces/${encodeURIComponent(workspaceId)}/ogcode?${qs.toString()}`,
    { method: "GET", credentials: "include" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { chapters?: string[] };
  return data.chapters ?? [];
}
