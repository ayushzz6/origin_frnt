"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/teacher-client";
import type { Batch } from "@/server/workspaces/types";

type Props = { workspaceId: string };

export function BatchCreateButton({ workspaceId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [scheduleText, setScheduleText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit() {
    setError(null);
    const result = await apiJson<{ batch: Batch }>(
      `/api/teacher/workspaces/${workspaceId}/batches`,
      {
        method: "POST",
        json: {
          name: name.trim(),
          subject: subject.trim() || null,
          scheduleText: scheduleText.trim() || null,
        },
      },
    );
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setOpen(false);
    setName("");
    setSubject("");
    setScheduleText("");
    router.refresh();
    router.push(`/teacher/workspaces/${workspaceId}/batches/${result.data.batch.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New batch</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create batch</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(() => void submit());
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="batch-name">Name</Label>
            <Input
              id="batch-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="batch-subject">Subject (optional)</Label>
            <Input
              id="batch-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="batch-schedule">Schedule note (optional)</Label>
            <Input
              id="batch-schedule"
              value={scheduleText}
              onChange={(event) => setScheduleText(event.target.value)}
              placeholder="Mon/Wed/Fri 5 PM"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
