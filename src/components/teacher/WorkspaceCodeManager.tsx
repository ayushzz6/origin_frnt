"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiJson } from "@/lib/teacher-client";
import type { WorkspaceCode } from "@/server/workspaces/types";

type Props = {
  workspaceId: string;
  initialCodes: WorkspaceCode[];
};

export function WorkspaceCodeManager({ workspaceId, initialCodes }: Props) {
  const [codes, setCodes] = useState(initialCodes);
  const [pending, startTransition] = useTransition();
  const [newCode, setNewCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeStudentCode = codes.find(
    (c) => c.codeType === "student_join" && c.status === "active",
  );

  async function rotate() {
    setError(null);
    const result = await apiJson<{ code: WorkspaceCode }>(
      `/api/teacher/workspaces/${workspaceId}/codes`,
      { method: "POST", json: { codeType: "student_join", rotate: true } },
    );
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    const refreshed = await apiJson<{ codes: WorkspaceCode[] }>(
      `/api/teacher/workspaces/${workspaceId}/codes`,
      { method: "GET" },
    );
    if (refreshed.ok) setCodes(refreshed.data.codes);
  }

  async function create() {
    setError(null);
    if (!newCode.trim()) return;
    const result = await apiJson<{ code: WorkspaceCode }>(
      `/api/teacher/workspaces/${workspaceId}/codes`,
      { method: "POST", json: { codeType: "student_join", rawDisplay: newCode } },
    );
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setNewCode("");
    const refreshed = await apiJson<{ codes: WorkspaceCode[] }>(
      `/api/teacher/workspaces/${workspaceId}/codes`,
      { method: "GET" },
    );
    if (refreshed.ok) setCodes(refreshed.data.codes);
  }

  async function revoke(codeId: string) {
    setError(null);
    const result = await apiJson<{ code: WorkspaceCode }>(
      `/api/teacher/workspaces/${workspaceId}/codes/${codeId}/revoke`,
      { method: "POST", json: {} },
    );
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    const refreshed = await apiJson<{ codes: WorkspaceCode[] }>(
      `/api/teacher/workspaces/${workspaceId}/codes`,
      { method: "GET" },
    );
    if (refreshed.ok) setCodes(refreshed.data.codes);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Active join code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeStudentCode ? (
            <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-4 py-3">
              <div>
                <p className="font-mono text-lg font-semibold tracking-wider">
                  {activeStudentCode.displayCode}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(activeStudentCode.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigator.clipboard.writeText(activeStudentCode.displayCode).catch(() => undefined)
                  }
                >
                  Copy
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => startTransition(() => void rotate())}
                >
                  Rotate
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active code. Create one below to start enrolling students.
            </p>
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium">Create custom code</p>
            <div className="flex gap-2">
              <Input
                value={newCode}
                onChange={(event) => setNewCode(event.target.value)}
                placeholder="MY-CODE-2026"
              />
              <Button
                onClick={() => startTransition(() => void create())}
                disabled={pending || !newCode.trim()}
              >
                Add
              </Button>
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Code history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No codes yet.</p>
          ) : (
            <ul className="divide-y">
              {codes.map((code) => (
                <li key={code.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-mono text-sm font-semibold tracking-wider">
                      {code.displayCode}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {code.codeType} · {code.status} ·{" "}
                      {new Date(code.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {code.status === "active" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => startTransition(() => void revoke(code.id))}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
