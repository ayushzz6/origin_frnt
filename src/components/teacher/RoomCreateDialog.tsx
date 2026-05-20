"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/teacher-client";
import type { TeacherRoomSummary } from "@/server/workspaces/types";

type Props = { workspaceId: string };

export function RoomCreateDialog({ workspaceId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function submit() {
    setError(null);
    const result = await apiJson<{ room: TeacherRoomSummary }>(
      `/api/teacher/workspaces/${workspaceId}/rooms`,
      { method: "POST", json: { name: name.trim() } },
    );
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setOpen(false);
    setName("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create room</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create live room</DialogTitle>
          <DialogDescription>
            Create a live test room for your enrolled students.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(() => void submit());
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="room-name">Room name</Label>
            <Input
              id="room-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Physics Live Test"
              required
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