export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getOgcodeCatalogQuestionMap } from "@/server/ogcode-catalog";
import { listBatches } from "@/server/workspaces/batches";
import { listTeacherQuestions } from "@/server/workspaces/questions-service";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";
import { getContentQuestionStoredMap } from "@/server/workspaces/test-question-resolver";
import { getTeacherTest } from "@/server/workspaces/tests-service";
import { TestEditClient } from "@/components/teacher/TestEditClient";
import type { WizardInitial } from "@/components/teacher/TestCreatorWizard";
import type { SelectedQuestion } from "@/components/teacher/QuestionPicker";

type Props = {
  params: Promise<{ workspaceId: string; testId: string }>;
};

export default async function EditTestPage({ params }: Props) {
  const { workspaceId, testId } = await params;
  await loadWorkspaceForRender(workspaceId);

  const test = await getTeacherTest(workspaceId, testId);
  if (!test) notFound();

  // Resolve question labels per source bank so the cart shows the real questions.
  const ogIds = test.questions
    .filter((q) => q.sourceBank === "ogcode")
    .map((q) => q.ogcodeQuestionId)
    .filter((id): id is string => Boolean(id));
  const contentIds = test.questions
    .filter((q) => q.sourceBank === "workspace_bag")
    .map((q) => q.contentQuestionId)
    .filter((id): id is string => Boolean(id));

  const [ogMap, contentMap, questions, batches] = await Promise.all([
    getOgcodeCatalogQuestionMap(ogIds),
    getContentQuestionStoredMap(contentIds),
    listTeacherQuestions(workspaceId, { status: "all" }),
    listBatches(workspaceId, { status: "active" }),
  ]);

  const selectedQuestions: SelectedQuestion[] = [...test.questions]
    .sort((a, b) => a.position - b.position)
    .map((q) => {
      const id = q.sourceBank === "ogcode" ? q.ogcodeQuestionId : q.contentQuestionId;
      const label =
        (q.sourceBank === "ogcode" ? ogMap.get(id ?? "") : contentMap.get(id ?? ""))?.text ?? "Question";
      return {
        sourceBank: q.sourceBank === "ogcode" ? ("ogcode" as const) : ("workspace_bag" as const),
        id: id ?? "",
        label,
        marks: q.marks,
        // stored negative is a negative number; the picker edits a positive value.
        negativeMarks: Math.abs(q.negativeMarks),
      };
    })
    .filter((q) => q.id);

  const scoring = (test.scoringPolicy ?? {}) as { positive?: number; negative?: number };
  const settings = (test.settings ?? {}) as {
    shuffle?: boolean;
    autoSubmit?: boolean;
    hideLeaderboard?: boolean;
  };

  const initial: WizardInitial = {
    title: test.title,
    description: test.description ?? "",
    subject: test.subject,
    difficulty: test.difficulty,
    durationMinutes: test.durationMinutes,
    marksPositive: scoring.positive ?? 4,
    marksNegative: scoring.negative ?? 1,
    selectedQuestions,
    status: test.status,
    shuffle: settings.shuffle ?? true,
    autoSubmit: settings.autoSubmit ?? true,
    hideLeaderboard: settings.hideLeaderboard ?? false,
  };

  return (
    <TestEditClient
      workspaceId={workspaceId}
      testId={testId}
      questions={questions}
      batches={batches}
      ogcodeEnabled={isFeatureEnabled("teacherOgcode")}
      initial={initial}
    />
  );
}
