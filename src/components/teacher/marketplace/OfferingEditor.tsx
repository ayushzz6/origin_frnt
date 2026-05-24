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
import { Textarea } from "@/components/ui/textarea";

type Props = {
  workspaceId: string;
};

export function OfferingEditor({ workspaceId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceMajor, setPriceMajor] = useState("999");
  const [currency, setCurrency] = useState("INR");
  const [targetBatchId, setTargetBatchId] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const priceMinor = Math.round(parseFloat(priceMajor) * 100);
      const res = await fetch(
        `/api/teacher/workspaces/${workspaceId}/offerings`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || null,
            priceMinor,
            currency,
            targetBatchId: targetBatchId || null,
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          detail?: string;
        };
        throw new Error(data.detail ?? `Create failed (${res.status})`);
      }
      const data = (await res.json()) as { offering: { id: string } };

      // If the form asked for "active" we follow up with a PATCH to flip
      // the status — keeps the POST API minimal but lets the editor
      // publish in one click.
      if (status === "active") {
        await fetch(
          `/api/teacher/workspaces/${workspaceId}/offerings/${data.offering.id}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "active" }),
          },
        );
      }
      router.refresh();
      setTitle("");
      setDescription("");
      setPriceMajor("999");
      setTargetBatchId("");
      setStatus("draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. JEE Advanced 2026 — Full Course"
            required
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What does the student get? Schedule, scope, materials, etc."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Price</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step="0.01"
            value={priceMajor}
            onChange={(e) => setPriceMajor(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">INR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="batch">Auto-assign batch ID (optional)</Label>
          <Input
            id="batch"
            value={targetBatchId}
            onChange={(e) => setTargetBatchId(e.target.value)}
            placeholder="batch_..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as typeof status)}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft (hidden)</SelectItem>
              <SelectItem value="active">Active (on marketplace)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Create offering"}
        </Button>
      </div>
    </form>
  );
}
