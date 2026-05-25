export const dynamic = "force-dynamic";

import { TestsManagerHighFidelity } from "@/components/teacher/TestsManagerHighFidelity";
import { listTeacherTests } from "@/server/workspaces/tests-service";
import { listTeacherQuestions } from "@/server/workspaces/questions-service";
import { listBatches } from "@/server/workspaces/batches";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function TeacherTestsPage({ params }: Props) {
  const { workspaceId } = await params;
  const { membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);

  const canManage =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher";

  // Fetch tests, questions, and batches in parallel
  const [tests, questions, batches] = await Promise.all([
    listTeacherTests(workspaceId, { status: "all" }),
    listTeacherQuestions(workspaceId, { status: "all" }),
    listBatches(workspaceId, { status: "active" }),
  ]);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <TestsManagerHighFidelity
        workspaceId={workspaceId}
        initialTests={tests}
        questions={questions}
        batches={batches}
        canManage={canManage}
      />
    </div>
  );
}