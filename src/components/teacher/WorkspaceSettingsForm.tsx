"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/teacher-client";
import type { TeacherWorkspace } from "@/server/workspaces/types";

type Props = {
  workspace: TeacherWorkspace;
  canEdit: boolean;
};

export function WorkspaceSettingsForm({ workspace, canEdit }: Props) {
  const [displayName, setDisplayName] = useState(workspace.displayName);
  const [legalName, setLegalName] = useState(workspace.legalName ?? "");
  const [city, setCity] = useState(workspace.city ?? "");
  const [state, setState] = useState(workspace.state ?? "");
  const [subjects, setSubjects] = useState((workspace.subjects ?? []).join(", "));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSave() {
    setError(null);
    setSuccess(null);
    const subjectList = subjects
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const result = await apiJson(`/api/teacher/workspaces/${workspace.id}`, {
      method: "PATCH",
      json: {
        displayName: displayName.trim(),
        legalName: legalName.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        subjects: subjectList,
      },
    });
    if (result.ok) {
      setSuccess("Saved.");
    } else {
      setError(result.detail);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => {
          void handleSave();
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          disabled={!canEdit}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="legalName">Legal name</Label>
        <Input
          id="legalName"
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            value={state}
            onChange={(event) => setState(event.target.value)}
            disabled={!canEdit}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="subjects">Subjects (comma separated)</Label>
        <Input
          id="subjects"
          value={subjects}
          onChange={(event) => setSubjects(event.target.value)}
          disabled={!canEdit}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
      <div className="pt-2">
        <Button type="submit" disabled={!canEdit || pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
