"use client";

/**
 * Reusable mixed-source question picker (Phase 15). Controlled: the parent owns the
 * ordered selection (`value`/`onChange`). Two source tabs — Question Bag (the
 * workspace's `content.questions`) and OG Code (the shared bank, via the paginated
 * teacher browse) — feed one ordered cart with per-question marks and up/down/top
 * reordering. Used by the test-builder wizard and the room build-in-place drawer so
 * general tests and room tests share one authoring surface.
 */

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUp, Minus, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { QuestionWithVersion } from "@/server/workspaces/types";

import { OgcodeQuestionList } from "./OgcodeQuestionList";
import type { OgcodeBrowseItem } from "./useOgcodeBrowse";

export type SelectedQuestion = {
  sourceBank: "ogcode" | "workspace_bag";
  /** ogcode id for ogcode rows; content-question id for workspace_bag rows. */
  id: string;
  label: string;
  marks: number;
  negativeMarks: number;
};

type Props = {
  value: SelectedQuestion[];
  onChange: (next: SelectedQuestion[]) => void;
  workspaceId: string;
  bagQuestions: QuestionWithVersion[];
  ogcodeEnabled: boolean;
  defaultMarks?: number;
  defaultNegativeMarks?: number;
};

export function QuestionPicker({
  value,
  onChange,
  workspaceId,
  bagQuestions,
  ogcodeEnabled,
  defaultMarks = 4,
  defaultNegativeMarks = 1,
}: Props) {
  const [bagSearch, setBagSearch] = useState("");

  const selectedBagIds = useMemo(
    () => new Set(value.filter((q) => q.sourceBank === "workspace_bag").map((q) => q.id)),
    [value],
  );
  const selectedOgcodeIds = useMemo(
    () => new Set(value.filter((q) => q.sourceBank === "ogcode").map((q) => q.id)),
    [value],
  );

  function add(item: SelectedQuestion) {
    if (value.some((q) => q.sourceBank === item.sourceBank && q.id === item.id)) return;
    onChange([...value, item]);
  }
  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function moveToTop(index: number) {
    if (index === 0) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    onChange(next);
  }
  function updateMarks(index: number, field: "marks" | "negativeMarks", raw: number) {
    const next = value.map((q, i) => (i === index ? { ...q, [field]: raw } : q));
    onChange(next);
  }

  const filteredBag = bagQuestions.filter((q) => {
    if (selectedBagIds.has(q.id)) return false;
    const term = bagSearch.trim().toLowerCase();
    if (!term) return true;
    const v = q.currentVersion;
    return (
      (v?.stem.toLowerCase().includes(term) ?? false) ||
      (v?.chapter.toLowerCase().includes(term) ?? false)
    );
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Source pane */}
      <div className="flex h-[60vh] flex-col overflow-hidden rounded-2xl border bg-card">
        <Tabs defaultValue="bag" className="flex h-full flex-col">
          <div className="border-b p-3">
            <TabsList>
              <TabsTrigger value="bag">Question Bag</TabsTrigger>
              {ogcodeEnabled ? <TabsTrigger value="ogcode">OG Code</TabsTrigger> : null}
            </TabsList>
          </div>

          <TabsContent value="bag" className="flex-1 overflow-y-auto p-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={bagSearch}
                onChange={(e) => setBagSearch(e.target.value)}
                placeholder="Search your question bag…"
                className="h-9 pl-9 text-xs"
              />
            </div>
            {filteredBag.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                No matching questions in your bag.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredBag.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium">{q.currentVersion?.stem}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {q.currentVersion?.chapter} · {q.currentVersion?.questionType.toUpperCase()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 shrink-0 p-0 text-primary"
                      onClick={() =>
                        add({
                          sourceBank: "workspace_bag",
                          id: q.id,
                          label: q.currentVersion?.stem ?? "Question",
                          marks: defaultMarks,
                          negativeMarks: defaultNegativeMarks,
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {ogcodeEnabled ? (
            <TabsContent value="ogcode" className="flex-1 overflow-y-auto p-3">
              <OgcodeQuestionList
                workspaceId={workspaceId}
                selectedIds={selectedOgcodeIds}
                renderAction={(item: OgcodeBrowseItem) => (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0 text-primary"
                    disabled={selectedOgcodeIds.has(item.id)}
                    onClick={() =>
                      add({
                        sourceBank: "ogcode",
                        id: item.id,
                        label: item.text,
                        marks: defaultMarks,
                        negativeMarks: defaultNegativeMarks,
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      </div>

      {/* Cart pane */}
      <div className="flex h-[60vh] flex-col overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/10 p-3">
          <Label className="text-xs font-bold uppercase text-primary">Test questions</Label>
          <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-primary">
            {value.length} selected
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {value.length === 0 ? (
            <p className="p-8 text-center text-xs text-muted-foreground">
              Empty. Add questions from the left — mix OG Code and your Question Bag freely.
            </p>
          ) : (
            <div className="space-y-2">
              {value.map((q, idx) => (
                <div
                  key={`${q.sourceBank}:${q.id}`}
                  className="space-y-2 rounded-lg border p-2 text-xs"
                >
                  <div className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <p className="line-clamp-2 flex-1 font-medium">{q.label}</p>
                    <Badge variant={q.sourceBank === "ogcode" ? "default" : "secondary"}>
                      {q.sourceBank === "ogcode" ? "OG" : "Bag"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pl-7">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        +
                        <Input
                          type="number"
                          value={q.marks}
                          min={0}
                          onChange={(e) => updateMarks(idx, "marks", Number(e.target.value))}
                          className="h-7 w-14 px-2 text-xs"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        −
                        <Input
                          type="number"
                          value={q.negativeMarks}
                          min={0}
                          onChange={(e) => updateMarks(idx, "negativeMarks", Number(e.target.value))}
                          className="h-7 w-14 px-2 text-xs"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={idx === 0}
                        onClick={() => moveToTop(idx)}
                        title="Move to top"
                      >
                        <ChevronsUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={idx === 0}
                        onClick={() => move(idx, -1)}
                        title="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={idx === value.length - 1}
                        onClick={() => move(idx, 1)}
                        title="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => removeAt(idx)}
                        title="Remove"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
