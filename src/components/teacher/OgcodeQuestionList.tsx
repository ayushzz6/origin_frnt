"use client";

/**
 * Reusable OG Code question list (Phase 15): filter bar + cards + infinite scroll.
 * Used read-only by the OG Code section and with an "Add" action by the test
 * builder's OG Code tab (via the `renderAction` render-prop). Owns the shared
 * `useOgcodeBrowse` state so both surfaces behave identically at scale.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useOgcodeBrowse, type OgcodeBrowseItem } from "./useOgcodeBrowse";

const SUBJECTS = [
  { value: "", label: "All" },
  { value: "physics", label: "Physics" },
  { value: "chemistry", label: "Chemistry" },
  { value: "mathematics", label: "Mathematics" },
  { value: "biology", label: "Biology" },
];
const DIFFICULTIES = ["", "easy", "medium", "hard", "insane"];
const TYPES = [
  { value: "", label: "All types" },
  { value: "mcq", label: "MCQ" },
  { value: "msq", label: "MSQ" },
  { value: "numerical", label: "Numerical" },
  { value: "matrix_match", label: "Matrix" },
  { value: "subjective", label: "Subjective" },
];

type Props = {
  workspaceId: string;
  /** Optional trailing action per card (e.g. an Add button in the picker). */
  renderAction?: (item: OgcodeBrowseItem) => ReactNode;
  /** Ids already selected — rendered dimmed so they read as "already added". */
  selectedIds?: Set<string>;
};

export function OgcodeQuestionList({ workspaceId, renderAction, selectedIds }: Props) {
  const { filters, setFilters, items, total, hasMore, loading, error, loadMore } =
    useOgcodeBrowse(workspaceId);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search question text, chapter, concept, tags…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s.value || "all"}
              type="button"
              onClick={() => setFilters((f) => ({ ...f, subject: s.value }))}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filters.subject === s.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {s.label}
            </button>
          ))}
          <select
            value={filters.difficulty}
            onChange={(e) => setFilters((f) => ({ ...f, difficulty: e.target.value }))}
            className="ml-auto rounded-lg border bg-background px-2 py-1 text-xs capitalize"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d || "all"} value={d}>
                {d || "All difficulty"}
              </option>
            ))}
          </select>
          <select
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            className="rounded-lg border bg-background px-2 py-1 text-xs"
          >
            {TYPES.map((t) => (
              <option key={t.value || "all"} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          {loading && items.length === 0 ? "Loading…" : `${total.toLocaleString()} questions`}
        </p>
      </div>

      {error ? <p className="py-6 text-sm text-destructive">{error}</p> : null}

      {/* Cards */}
      <div className="space-y-2">
        {items.map((q) => {
          const selected = selectedIds?.has(q.id) ?? false;
          return (
            <Card key={q.id} className={selected ? "opacity-60" : undefined}>
              <CardContent className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0 space-y-1">
                  <p className="line-clamp-2 text-sm font-medium">{q.text}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className="capitalize">
                      {q.subject}
                    </Badge>
                    {q.chapter ? <Badge variant="outline">{q.chapter}</Badge> : null}
                    <Badge variant="outline" className="capitalize">
                      {q.difficulty}
                    </Badge>
                    <Badge variant="secondary" className="uppercase">
                      {q.questionType}
                    </Badge>
                  </div>
                </div>
                {renderAction ? <div className="shrink-0">{renderAction(q)}</div> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Infinite-scroll sentinel + state */}
      <div ref={sentinelRef} className="flex justify-center py-4">
        {loading && items.length > 0 ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !hasMore && items.length > 0 ? (
          <span className="text-xs text-muted-foreground">End of results</span>
        ) : null}
      </div>

      {!loading && items.length === 0 && !error ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No questions match these filters.
        </p>
      ) : null}
    </div>
  );
}
