import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { TestCohortAnalytics } from "@/components/teacher/TestCohortAnalytics";
import { getTeacherTest } from "@/server/workspaces/tests-service";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceId: string; testId: string }>;
};

export default async function TeacherTestResultsPage({ params }: Props) {
  const { workspaceId, testId } = await params;
  await loadWorkspaceForRender(workspaceId);

  const test = await getTeacherTest(workspaceId, testId);
  if (!test) notFound();

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Link
          href={`/teacher/workspaces/${workspaceId}/tests`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Tests
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{test.title}</h1>
        <p className="text-muted-foreground text-sm">
          Who attempted this test, the cohort&apos;s topic weakness, and each student&apos;s
          individual analytics.
        </p>
      </div>

      <TestCohortAnalytics workspaceId={workspaceId} testId={testId} />
    </div>
  );
}
