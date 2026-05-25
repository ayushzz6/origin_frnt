"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiJson } from "@/lib/teacher-client";

type Props = {
  workspaceId: string;
  batchId: string;
  batchName: string;
};

export function BatchDeleteButton({ workspaceId, batchId, batchName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await apiJson<{ ok: boolean }>(
        `/api/teacher/workspaces/${workspaceId}/batches/${batchId}`,
        { method: "DELETE" },
      );
      if (!result.ok) {
        setError(result.detail);
        return;
      }
      setOpen(false);
      router.push(`/teacher/workspaces/${workspaceId}/batches`);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete batch
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{batchName}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            Members are detached and the batch is archived. Tests, rooms, and
            enrollments that referenced this batch keep working but lose the
            grouping. This action is audited.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              handleDelete();
            }}
          >
            {pending ? "Deleting…" : "Yes, delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
