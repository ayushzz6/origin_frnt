"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Loader2, Check } from "lucide-react";

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

const BUILD_STEPS = [
  "Provisioning the live room…",
  "Setting up real-time chat & presence…",
  "Generating the join code…",
];

export function RoomCreateDialog({ workspaceId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  // Guards against a double-submit creating two rooms before the first responds.
  const submittingRef = useRef(false);

  async function submit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setBuilding(true);

    // Idempotency hint for the audit trail / future server-side dedup.
    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;

    const result = await apiJson<{ room: TeacherRoomSummary }>(
      `/api/teacher/workspaces/${workspaceId}/rooms`,
      { method: "POST", json: { name: name.trim(), requestId } },
    );

    if (!result.ok) {
      submittingRef.current = false;
      setBuilding(false);
      setError(result.detail);
      return;
    }

    // Navigate straight into the new room — this is what prevents the teacher
    // from re-clicking Create and producing a duplicate.
    router.push(`/teacher/workspaces/${workspaceId}/rooms/${result.data.room.id}`);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Lock the dialog closed while a room is building.
        if (building) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>Create room</Button>
      </DialogTrigger>
      <DialogContent>
        {building ? (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold">Building your live room</h3>
              <p className="text-sm text-muted-foreground">This only takes a moment — hang tight.</p>
            </div>
            <ul className="w-full max-w-xs space-y-2 text-left">
              {BUILD_STEPS.map((step, idx) => (
                <li
                  key={step}
                  className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse"
                  style={{ animationDelay: `${idx * 250}ms` }}
                >
                  <Check className="h-4 w-4 shrink-0 text-primary/60" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create live room</DialogTitle>
              <DialogDescription>Create a live test room for your enrolled students.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
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
                <Button type="submit" disabled={!name.trim()}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
