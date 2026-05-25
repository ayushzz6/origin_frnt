export const dynamic = "force-dynamic";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateTestDialog } from "@/components/teacher/CreateTestDialog";
import { listTeacherTests } from "@/server/workspaces/tests-service";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string }>;
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
  draft: "text-muted-foreground",
  scheduled: "text-blue-600",
  published: "text-green-600",
  live: "text-orange-600",
  closed: "text-gray-500",
  archived: "text-gray-400",
};

export default async function TeacherTestsPage({ params }: Props) {
  const { workspaceId } = await params;
  const { membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);
  const canCreate =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher";

  const tests = await listTeacherTests(workspaceId, { status: "all" });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tests</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {tests.length} tests total.
          </p>
        </div>
        {canCreate ? <CreateTestDialog workspaceId={workspaceId} /> : null}
      </div>

      {tests.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No tests yet</CardTitle>
            <CardDescription>
              {canCreate
                ? "Click \"Create test\" above to pick questions from the workspace Question Bag and seed the first test."
                : "Tests created by an owner/admin/teacher will appear here."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <Card key={test.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <span className="font-medium">{test.title}</span>
                  <span className={`text-xs font-mono uppercase tracking-wide ${STATUS_COLORS[test.status] ?? ""}`}>
                    {STATUS_LABELS[test.status] ?? test.status}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{test.subject}</span>
                  <span>·</span>
                  <span>{test.totalQuestions} questions</span>
                  <span>·</span>
                  <span>{test.durationMinutes} min</span>
                  <span>·</span>
                  <span>{test.difficulty}</span>
                </div>
                {test.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-1">
                    {test.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}