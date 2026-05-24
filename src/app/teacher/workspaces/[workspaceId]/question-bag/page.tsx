import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QuestionEditorDialog } from "@/components/teacher/QuestionEditorDialog";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { listTeacherQuestions } from "@/server/workspaces/questions-service";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  needs_review: "Needs Review",
  ready: "Ready",
  published_private: "Published",
  submitted_to_ogcode: "Submitted to OGCode",
  published_ogcode: "OGCode",
  rejected: "Rejected",
  archived: "Archived",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-green-600",
  medium: "text-yellow-600",
  hard: "text-orange-600",
  insane: "text-red-600",
};

export default async function QuestionBagPage({ params }: Props) {
  const { workspaceId } = await params;
  const { membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);
  const canEdit =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher" ||
    membership?.role === "content_manager";

  const questions = await listTeacherQuestions(workspaceId, { status: "all" });

  const importEnabled = isFeatureEnabled("documentImport");

  const statusCounts = questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.status] = (acc[q.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Question Bag</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {questions.length} questions total.
          </p>
        </div>
        {/*
          Audit fix R-4 (A-12): the page copy says "create manually or
          import from a document" but only the manual path had a CTA.
          Expose the AI-import flow side-by-side with the editor dialog.
          Gated on the documentImport feature flag — when off, only the
          manual editor renders.
        */}
        {canEdit && (
          <div className="flex items-center gap-2">
            {importEnabled && (
              <Button asChild variant="outline">
                <Link href={`/teacher/workspaces/${workspaceId}/question-bag/import`}>
                  Import from PDF
                </Link>
              </Button>
            )}
            <QuestionEditorDialog workspaceId={workspaceId} />
          </div>
        )}
      </div>

      {Object.keys(statusCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <span
              key={status}
              className="rounded-full border bg-background px-3 py-1 text-xs font-medium"
            >
              {STATUS_LABELS[status] ?? status}: {count}
            </span>
          ))}
        </div>
      )}

      {questions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No questions yet</CardTitle>
            <CardDescription>
              Create your first question manually or import from a document.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => {
            const v = q.currentVersion;
            return (
              <Link
                key={q.id}
                href={`/teacher/workspaces/${workspaceId}/question-bag/${q.id}`}
                className="block"
              >
                <Card className="transition-all hover:border-primary/40 hover:shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-start justify-between gap-2 text-base">
                      <span className="line-clamp-2 flex-1 text-sm font-medium">
                        {v?.stem ?? "(no stem)"}
                      </span>
                      <span className="shrink-0 text-xs font-mono uppercase tracking-wide text-muted-foreground">
                        {q.status}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {v && (
                        <>
                          <span className="rounded border px-1.5 py-0.5">
                            {v.questionType.toUpperCase()}
                          </span>
                          <span className="rounded border px-1.5 py-0.5">
                            {v.subject}
                          </span>
                          <span className="rounded border px-1.5 py-0.5">
                            {v.chapter}
                          </span>
                          <span className={`rounded border px-1.5 py-0.5 font-medium ${DIFFICULTY_COLORS[v.difficulty] ?? ""}`}>
                            {v.difficulty}
                          </span>
                        </>
                      )}
                    </div>
                    {v?.tags && v.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {v.tags.slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}