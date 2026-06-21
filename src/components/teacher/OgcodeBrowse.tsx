"use client";

/**
 * Read-only teacher OG Code bank browser (Phase 15). A thin wrapper over the
 * shared OgcodeQuestionList — selection/cart lives in the test-builder picker.
 */

import { OgcodeQuestionList } from "./OgcodeQuestionList";

export function OgcodeBrowse({ workspaceId }: { workspaceId: string }) {
  return <OgcodeQuestionList workspaceId={workspaceId} />;
}

export default OgcodeBrowse;
