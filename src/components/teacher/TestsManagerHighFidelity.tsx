"use client";

import { useState } from "react";
import { Plus, Search, Calendar, Clock, BarChart4, ChevronRight, HelpCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TestCreatorWizard } from "./TestCreatorWizard";
import type { QuestionWithVersion, BatchWithCounts, AssessmentTest } from "@/server/workspaces/types";

type Props = {
  workspaceId: string;
  initialTests: AssessmentTest[];
  questions: QuestionWithVersion[];
  batches: BatchWithCounts[];
  canManage: boolean;
  ogcodeEnabled: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  live: "Live",
  closed: "Closed",
  archived: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-muted-foreground bg-muted border-muted/50",
  scheduled: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  published: "text-green-500 bg-green-500/10 border-green-500/20",
  live: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 animate-pulse",
  closed: "text-gray-500 bg-muted border-muted",
  archived: "text-gray-400 bg-muted border-muted",
};

export function TestsManagerHighFidelity({ workspaceId, initialTests, questions, batches, canManage, ogcodeEnabled }: Props) {
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTests = initialTests.filter(test => {
    if (searchQuery.trim()) {
      return test.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  if (isCreating) {
    return (
      <TestCreatorWizard
        workspaceId={workspaceId}
        questions={questions}
        batches={batches}
        ogcodeEnabled={ogcodeEnabled}
        onSuccess={() => setIsCreating(false)}
        onCancel={() => setIsCreating(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assessments & Mock Tests</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Author mock tests, track scheduled student windows, and view grading results.
          </p>
        </div>
        {canManage && (
          <Button 
            onClick={() => setIsCreating(true)}
            className="bg-primary hover:bg-primary/95 text-black font-semibold gap-1.5 h-10 rounded-xl w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Create Scheduled Test
          </Button>
        )}
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tests by title..."
          className="pl-9 h-10 rounded-xl"
        />
      </div>

      {/* Roster list */}
      <div className="space-y-3">
        {filteredTests.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground border border-dashed rounded-2xl">
            <Calendar className="w-10 h-10 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-sm font-semibold">No assessments scheduled.</p>
            <p className="text-xs">Click the button in the header to schedule your first exam.</p>
          </div>
        ) : (
          filteredTests.map((test) => (
            <Card key={test.id} className="hover:border-primary/20 transition-all border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <span className="font-semibold text-sm">{test.title}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 border rounded-full ${STATUS_COLORS[test.status] || ""}`}>
                    {STATUS_LABELS[test.status] || test.status}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-semibold">
                  <span className="text-primary">{test.subject}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {test.durationMinutes} mins</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" /> {test.totalQuestions} questions</span>
                  <span>·</span>
                  <span className="capitalize">{test.difficulty}</span>
                </div>
                {test.description && (
                  <p className="text-xs text-muted-foreground pt-1">{test.description}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

    </div>
  );
}
