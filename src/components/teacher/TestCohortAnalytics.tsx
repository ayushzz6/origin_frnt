"use client";

import { useEffect, useState } from "react";
import {
  Users,
  BarChart4,
  AlertTriangle,
  TrendingUp,
  Loader2,
  Check,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/teacher-client";
import TestResultView from "@/sections/TestResultView";
import type { TestResult } from "@/types";

type Props = {
  workspaceId: string;
  testId: string;
};

// Shapes returned by the per-test cohort route.
type CohortAttempt = {
  rank: number;
  resultId: string;
  studentId: string;
  displayName: string;
  batchId: string | null;
  percentage: number | null;
  score: number | null;
  totalMarks: number | null;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  timeTakenSeconds: number;
  analysisStatus: string;
  submittedAt: string;
};

type TopicWeakness = {
  topic: string;
  subject: string;
  chapter: string | null;
  accuracy: number; // 0–100
  attempts: number;
  students: number;
  severity: "high" | "medium" | "low";
};

type RadarRow = { topic: string; accuracy: number; fullMark: number };

const SEVERITY_STYLE: Record<TopicWeakness["severity"], string> = {
  high: "text-destructive",
  medium: "text-amber-500",
  low: "text-emerald-500",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function TestCohortAnalytics({ workspaceId, testId }: Props) {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<CohortAttempt[]>([]);
  const [weakTopics, setWeakTopics] = useState<TopicWeakness[]>([]);

  // Individual student drill-down (reuses the student TestResultView).
  const [selected, setSelected] = useState<CohortAttempt | null>(null);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const base = `/api/teacher/workspaces/${workspaceId}/tests/${testId}/cohort`;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiJson<{ attempts: CohortAttempt[] }>(`${base}?type=attempts`),
      apiJson<{ weakTopics: TopicWeakness[] }>(`${base}?type=weak-topics`),
    ])
      .then(([attemptsRes, weakRes]) => {
        if (cancelled) return;
        if (attemptsRes.ok) setAttempts(attemptsRes.data.attempts ?? []);
        if (weakRes.ok) setWeakTopics(weakRes.data.weakTopics ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  async function openStudent(attempt: CohortAttempt) {
    setSelected(attempt);
    setSelectedResult(null);
    setDrillLoading(true);
    const res = await apiJson<{ result: TestResult }>(
      `/api/teacher/workspaces/${workspaceId}/analytics/results/${attempt.resultId}`,
    );
    setDrillLoading(false);
    setSelectedResult(res.ok ? res.data.result : null);
  }

  function closeStudent() {
    setSelected(null);
    setSelectedResult(null);
  }

  // Radar = topic accuracy across the cohort, weakest first (cap at 8 spokes).
  const radarData: RadarRow[] = weakTopics
    .slice(0, 8)
    .map((t) => ({ topic: t.topic, accuracy: Math.round(t.accuracy), fullMark: 100 }));

  const validPct = attempts.filter((a) => a.percentage != null);
  const averagePct =
    validPct.length > 0
      ? Math.round(validPct.reduce((sum, a) => sum + (a.percentage ?? 0), 0) / validPct.length)
      : null;
  const topPct = validPct.length > 0 ? Math.round(Math.max(...validPct.map((a) => a.percentage ?? 0))) : null;
  const weakCount = weakTopics.filter((t) => t.severity !== "low").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading test analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview metrics */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Attempts</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold">{attempts.length}</span>
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Average Score</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold">{averagePct === null ? "—" : `${averagePct}%`}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Top Score</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold">{topPct === null ? "—" : `${topPct}%`}</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Weak Topics</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-destructive">{weakCount}</span>
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Topic-weakness radar */}
        <Card className="lg:col-span-2 border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart4 className="w-5 h-5 text-primary" /> Topic Mastery Radar
            </CardTitle>
            <CardDescription>Cohort topic accuracy from this test — lower means weaker.</CardDescription>
          </CardHeader>
          <CardContent className="h-80 flex items-center justify-center p-2">
            {radarData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center px-6">
                No topic analytics yet. The radar populates once submissions have been analysed.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="topic" stroke="#a3a3a3" style={{ fontSize: "10px", fontWeight: "bold" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#737373" style={{ fontSize: "8px" }} />
                  <Radar name="Accuracy" dataKey="accuracy" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Weak-topic list */}
        <Card className="lg:col-span-1 border flex flex-col">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" /> Weak Topics
            </CardTitle>
            <CardDescription>Cover these in your next class.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto divide-y pr-1">
            {weakTopics.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground py-20">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" /> No topic analytics yet.
              </div>
            ) : (
              weakTopics.map((t) => (
                <div key={`${t.subject}-${t.topic}`} className="py-3 flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h4 className="font-semibold text-sm">{t.topic}</h4>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {t.subject} · {t.students} students · {t.attempts} attempts
                    </p>
                  </div>
                  <span className={`text-xs font-mono font-bold ${SEVERITY_STYLE[t.severity]}`}>
                    {Math.round(t.accuracy)}%
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attempt directory — click a student to open their individual analytics */}
      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Students Who Attempted
          </CardTitle>
          <CardDescription>Click a student to view their individual test analytics.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {attempts.length === 0 ? (
            <p className="p-6 text-xs text-muted-foreground">No submissions yet for this test.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="p-4 text-center">Rank</th>
                    <th className="p-4">Student</th>
                    <th className="p-4 text-center">Score</th>
                    <th className="p-4 text-center">Correct</th>
                    <th className="p-4 text-center">Time</th>
                    <th className="p-4">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {attempts.map((a) => {
                    const pct = a.percentage == null ? null : Math.round(a.percentage);
                    return (
                      <tr
                        key={a.resultId}
                        onClick={() => openStudent(a)}
                        className={`cursor-pointer transition-colors ${
                          selected?.resultId === a.resultId ? "bg-primary/10" : "hover:bg-muted/10"
                        }`}
                      >
                        <td className="p-4 text-center font-bold">#{a.rank}</td>
                        <td className="p-4 font-semibold text-sm">{a.displayName}</td>
                        <td
                          className={`p-4 text-center font-bold ${
                            pct == null
                              ? "text-muted-foreground"
                              : pct < 50
                                ? "text-destructive"
                                : pct < 75
                                  ? "text-amber-500"
                                  : "text-emerald-500"
                          }`}
                        >
                          {pct == null ? "—" : `${pct}%`}
                        </td>
                        <td className="p-4 text-center text-muted-foreground font-semibold">
                          {a.correctAnswers}/{a.correctAnswers + a.wrongAnswers + a.unattempted}
                        </td>
                        <td className="p-4 text-center text-muted-foreground">{formatDuration(a.timeTakenSeconds)}</td>
                        <td className="p-4 text-muted-foreground">
                          {new Date(a.submittedAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual analytics drill-down — reuses the student TestResultView */}
      {selected ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
            <div>
              <h2 className="text-sm font-bold">{selected.displayName} — Individual Analytics</h2>
              <p className="text-[11px] text-muted-foreground">
                {selected.percentage == null ? "—" : `${Math.round(selected.percentage)}%`} · rank #{selected.rank}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={closeStudent}>
              <X className="h-4 w-4" /> Close
            </Button>
          </div>
          <div className="p-2 md:p-4">
            {drillLoading ? (
              <div className="flex items-center gap-2 p-10 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading individual analytics…
              </div>
            ) : !selectedResult ? (
              <p className="p-10 text-xs text-muted-foreground">
                No analytics available for this student&apos;s attempt.
              </p>
            ) : (
              <TestResultView
                result={selectedResult}
                history={[selectedResult]}
                showSummary
                onBackToDashboard={closeStudent}
                onViewDPP={closeStudent}
                onRetakeTest={closeStudent}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
