"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

function isRecoverableLoadError(error: Error): boolean {
  const message = error.message ?? "";
  const name = error.name ?? "";
  return (
    name === "ChunkLoadError" ||
    message.includes("Loading chunk") ||
    message.includes("Failed to fetch") ||
    message.includes("dynamically imported module")
  );
}

export default function ImportReviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isRecoverableLoadError(error)) return;
    const key = "origin-import-review-reload";
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last > 10_000) {
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle className="h-10 w-10 text-muted-foreground" />
      <div className="space-y-1">
        <h2 className="text-lg font-bold">Import review couldn&apos;t load</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {error.message || "Something went wrong while opening this import job."}
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button type="button" variant="outline" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" variant="ghost" onClick={() => window.history.back()}>
          Back
        </Button>
      </div>
    </div>
  );
}
