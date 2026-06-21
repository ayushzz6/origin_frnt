"use client";

/**
 * Client wrapper for editing a test: renders the shared TestCreatorWizard in edit
 * mode (pre-filled) and returns to the tests list on success/cancel.
 */

import { useRouter } from "next/navigation";

import { TestCreatorWizard, type WizardInitial } from "./TestCreatorWizard";
import type { QuestionWithVersion, BatchWithCounts } from "@/server/workspaces/types";

type Props = {
  workspaceId: string;
  testId: string;
  questions: QuestionWithVersion[];
  batches: BatchWithCounts[];
  ogcodeEnabled: boolean;
  initial: WizardInitial;
};

export function TestEditClient({ workspaceId, testId, questions, batches, ogcodeEnabled, initial }: Props) {
  const router = useRouter();
  const back = () => router.push(`/teacher/workspaces/${workspaceId}/tests`);

  return (
    <div className="mx-auto max-w-6xl animate-fade-in py-6">
      <TestCreatorWizard
        workspaceId={workspaceId}
        questions={questions}
        batches={batches}
        ogcodeEnabled={ogcodeEnabled}
        mode="edit"
        testId={testId}
        initial={initial}
        onSuccess={back}
        onCancel={back}
      />
    </div>
  );
}
