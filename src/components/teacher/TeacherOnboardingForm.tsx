"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiJson } from "@/lib/teacher-client";
import type { TeacherWorkspace, WorkspaceCode } from "@/server/workspaces/types";

type OnboardingResult = { workspace: TeacherWorkspace; joinCode: WorkspaceCode };
type Availability =
  | { available: true; normalizedCode: string; displayCode: string }
  | { available: false; reason: string; normalizedCode: string | null };

export function TeacherOnboardingForm() {
  const router = useRouter();

  return (
    <Tabs defaultValue="personal" className="space-y-6">
      <TabsList className="w-full">
        <TabsTrigger value="personal" className="flex-1">
          Personal teacher
        </TabsTrigger>
        <TabsTrigger value="institute" className="flex-1">
          Institute / Coaching
        </TabsTrigger>
      </TabsList>

      <TabsContent value="personal">
        <PersonalForm onCreated={(result) => router.push(`/teacher/workspaces/${result.workspace.id}`)} />
      </TabsContent>
      <TabsContent value="institute">
        <InstituteForm onCreated={(result) => router.push(`/teacher/workspaces/${result.workspace.id}`)} />
      </TabsContent>
    </Tabs>
  );
}

function PersonalForm({ onCreated }: { onCreated: (result: OnboardingResult) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [subjects, setSubjects] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit() {
    setError(null);
    const result = await apiJson<OnboardingResult>("/api/teacher/onboarding", {
      method: "POST",
      json: {
        workspaceType: "personal",
        displayName: displayName.trim(),
        subjects: subjects.split(",").map((s) => s.trim()).filter(Boolean),
        city: city.trim() || null,
        state: state.trim() || null,
      },
    });
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    onCreated(result.data);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal teacher workspace</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(() => {
              void submit();
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Ms. Sharma's Physics Class"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subjects-personal">Subjects you teach</Label>
            <Input
              id="subjects-personal"
              value={subjects}
              onChange={(event) => setSubjects(event.target.value)}
              placeholder="Physics, Math"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city-personal">City</Label>
              <Input
                id="city-personal"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state-personal">State</Label>
              <Input
                id="state-personal"
                value={state}
                onChange={(event) => setState(event.target.value)}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending || !displayName.trim()} className="w-full">
            {pending ? "Creating…" : "Create personal workspace"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function InstituteForm({ onCreated }: { onCreated: (result: OnboardingResult) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [rawCode, setRawCode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [subjects, setSubjects] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [checking, setChecking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!rawCode.trim()) {
      setAvailability(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      const result = await apiJson<Availability>("/api/teacher/codes/check", {
        method: "POST",
        json: { rawDisplay: rawCode },
      });
      setChecking(false);
      if (result.ok) {
        setAvailability(result.data);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rawCode]);

  async function submit() {
    setError(null);
    if (availability && !availability.available) {
      setError(availability.reason);
      return;
    }
    const result = await apiJson<OnboardingResult>("/api/teacher/onboarding", {
      method: "POST",
      json: {
        workspaceType: "institute",
        displayName: displayName.trim(),
        legalName: legalName.trim() || null,
        rawCode: rawCode.trim(),
        subjects: subjects.split(",").map((s) => s.trim()).filter(Boolean),
        city: city.trim() || null,
        state: state.trim() || null,
      },
    });
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    onCreated(result.data);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Institute workspace</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(() => {
              void submit();
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="institute-name">Institute display name</Label>
            <Input
              id="institute-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Akash Coaching"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="institute-legal-name">Legal name (optional)</Label>
            <Input
              id="institute-legal-name"
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="institute-code">Organization code</Label>
            <Input
              id="institute-code"
              value={rawCode}
              onChange={(event) => setRawCode(event.target.value)}
              placeholder="AKASH-PHY-12"
              required
            />
            <CodeAvailabilityHint
              checking={checking}
              availability={availability}
              raw={rawCode}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="institute-subjects">Subjects</Label>
            <Input
              id="institute-subjects"
              value={subjects}
              onChange={(event) => setSubjects(event.target.value)}
              placeholder="Physics, Chemistry, Math"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city-institute">City</Label>
              <Input
                id="city-institute"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state-institute">State</Label>
              <Input
                id="state-institute"
                value={state}
                onChange={(event) => setState(event.target.value)}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            disabled={
              pending ||
              !displayName.trim() ||
              !rawCode.trim() ||
              (availability !== null && !availability.available)
            }
            className="w-full"
          >
            {pending ? "Creating…" : "Create institute workspace"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CodeAvailabilityHint({
  checking,
  availability,
  raw,
}: {
  checking: boolean;
  availability: Availability | null;
  raw: string;
}) {
  if (!raw.trim()) return null;
  if (checking) {
    return <p className="text-xs text-muted-foreground">Checking…</p>;
  }
  if (!availability) return null;
  if (availability.available) {
    return (
      <p className="text-xs text-emerald-600">
        Available as <span className="font-mono">{availability.normalizedCode}</span>
      </p>
    );
  }
  return <p className="text-xs text-destructive">{availability.reason}</p>;
}
