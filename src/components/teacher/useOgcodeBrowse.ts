"use client";

/**
 * Shared OG Code browse state (Phase 15): filters + accumulating pages + infinite
 * scroll. Reused by the read-only OG Code section and the test-builder's OG Code
 * source tab so both behave identically at scale (server paging, bounded DOM).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchOgcodeBrowsePage,
  type OgcodeBrowseItem,
  type OgcodeBrowseParams,
} from "@/features/teacher-ogcode/client";

const PAGE_SIZE = 30;

export type OgcodeBrowseFilterState = {
  subject: string; // "" = all
  difficulty: string; // "" = all
  type: string; // "" = all
  search: string;
};

const EMPTY_FILTERS: OgcodeBrowseFilterState = { subject: "", difficulty: "", type: "", search: "" };

export function useOgcodeBrowse(workspaceId: string) {
  const [filters, setFilters] = useState<OgcodeBrowseFilterState>(EMPTY_FILTERS);
  const [items, setItems] = useState<OgcodeBrowseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  const load = useCallback(
    async (nextOffset: number, replace: boolean) => {
      const reqId = ++reqIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const params: OgcodeBrowseParams = {
          subject: filters.subject || null,
          difficulty: filters.difficulty || null,
          type: filters.type || null,
          search: filters.search || null,
          limit: PAGE_SIZE,
          offset: nextOffset,
        };
        const page = await fetchOgcodeBrowsePage(workspaceId, params);
        if (reqId !== reqIdRef.current) return; // a newer request superseded this one
        setItems((prev) => (replace ? page.items : [...prev, ...page.items]));
        setTotal(page.total);
        setOffset(nextOffset + page.items.length);
        setHasMore(page.hasMore);
      } catch (e) {
        if (reqId !== reqIdRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to load OG Code questions.");
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    },
    [workspaceId, filters.subject, filters.difficulty, filters.type, filters.search],
  );

  // Reload from the first page whenever the filters change (load identity tracks them).
  useEffect(() => {
    void load(0, true);
  }, [load]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) void load(offset, false);
  }, [loading, hasMore, offset, load]);

  return { filters, setFilters, items, total, hasMore, loading, error, loadMore };
}

export type { OgcodeBrowseItem };
