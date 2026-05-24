"use client";

/**
 * Workspace export button — audit fix R-5 (A-20).
 *
 * The /api/admin/workspaces/[id]/export endpoint streams a JSON dump
 * of the workspace's content (members, codes, batches, enrollments,
 * questions, tests, offerings, audit events). Before this PR the
 * endpoint had no UI; operators had to curl. This button issues a
 * GET, treats the response as a Blob, and triggers a file download
 * named with the workspace id + timestamp.
 */

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
};

export function WorkspaceExportButton({ workspaceId }: Props) {
  const [pending, setPending] = useState(false);

  const handleExport = async () => {
    setPending(true);
    try {
      const res = await fetch(
        `/api/admin/workspaces/${workspaceId}/export`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `workspace-${workspaceId}-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Workspace export downloaded");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Export failed";
      toast.error(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Download export
    </Button>
  );
}
