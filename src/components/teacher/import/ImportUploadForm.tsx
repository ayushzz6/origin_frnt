"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { csrfHeaders } from "@/lib/csrf";

type Props = {
  workspaceId: string;
};

const SOURCE_TYPES: ReadonlyArray<{
  value: "pdf" | "docx" | "image";
  label: string;
  accept: string;
}> = [
  { value: "pdf", label: "PDF", accept: ".pdf,application/pdf" },
  {
    value: "docx",
    label: "DOCX",
    accept:
      ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  { value: "image", label: "Image", accept: ".png,.jpg,.jpeg,.webp,image/*" },
];

const TARGET_SURFACES = [
  { value: "question_bag", label: "Workspace Question Bag (private)" },
  { value: "ogcode_draft", label: "OGCode draft (submitted for moderation)" },
] as const;

export function ImportUploadForm({ workspaceId }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<"pdf" | "docx" | "image">("pdf");
  const [targetSurface, setTargetSurface] =
    useState<(typeof TARGET_SURFACES)[number]["value"]>("question_bag");
  const [requestedCount, setRequestedCount] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = SOURCE_TYPES.find((s) => s.value === sourceType)?.accept ?? "";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Please select a file.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("sourceType", sourceType);
      formData.set("targetSurface", targetSurface);
      if (requestedCount) formData.set("requestedQuestionCount", requestedCount);
      if (subject) formData.set("subject", subject);
      if (chapter) formData.set("chapter", chapter);

      const res = await fetch(
        `/api/teacher/workspaces/${workspaceId}/import-jobs`,
        {
          method: "POST",
          headers: { ...csrfHeaders() },
          credentials: "include",
          body: formData,
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          detail?: string;
        };
        throw new Error(data.detail ?? `Upload failed (${res.status})`);
      }
      const data = (await res.json()) as { job: { id: string } };
      router.push(
        `/teacher/workspaces/${workspaceId}/question-bag/import/${data.job.id}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="source-type">Source type</Label>
          <Select
            value={sourceType}
            onValueChange={(v) => setSourceType(v as typeof sourceType)}
          >
            <SelectTrigger id="source-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_TYPES.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="target-surface">Where should the drafts land?</Label>
          <Select
            value={targetSurface}
            onValueChange={(v) =>
              setTargetSurface(v as typeof targetSurface)
            }
          >
            <SelectTrigger id="target-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_SURFACES.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">Subject (optional hint)</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Physics"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="chapter">Chapter (optional hint)</Label>
          <Input
            id="chapter"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="e.g. Kinematics"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="requested-count">
            Expected question count (optional)
          </Label>
          <Input
            id="requested-count"
            type="number"
            min={1}
            max={2000}
            value={requestedCount}
            onChange={(e) => setRequestedCount(e.target.value)}
            placeholder="Helps the verifier flag count mismatch"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="file">File</Label>
          <Input
            id="file"
            type="file"
            accept={accept}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Uploading…" : "Start import"}
        </Button>
      </div>
    </form>
  );
}
