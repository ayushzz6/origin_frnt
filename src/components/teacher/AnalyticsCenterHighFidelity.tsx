"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Users,
  BarChart4,
  Check,
  Sparkles,
  Loader2,
  AlertTriangle,
  Award,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiJson } from "@/lib/teacher-client";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
  batchId: string;
};

// ─── Shapes returned by the Phase-8 analytics routes (2E wires these) ─────────
type TopicSnapshot = {
  id: string;
  topic: string;
  subject: string;
  chapter: string | null;
  accuracy: number; // 0–1
  attempts: number;
  severity: "high" | "medium" | "low";
  snapshotAt: string;
};

type LeaderboardEntry = {
  rank: number;
  studentId: string;
  displayName: string;
  meanPercentage: number;
  attempts: number;
  platformRank: number;
};

type LeaderboardSnap = { entries: LeaderboardEntry[]; snapshotAt: string };

type RadarRow = { subject: string; Physics: number; Chemistry: number; Math: number; fullMark: number };

const SUBJECT_KEY: Record<string, "Physics" | "Chemistry" | "Math" | null> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Math",
  maths: "Math",
  mathematics: "Math",
};

/** Most-recent snapshot per topic → a radar row keyed by the topic's subject column. */
function buildRadarData(snapshots: TopicSnapshot[]): RadarRow[] {
  const byTopic = new Map<string, TopicSnapshot>();
  for (const snap of snapshots) {
    // snapshots arrive newest-first; keep the first (latest) per topic.
    if (!byTopic.has(snap.topic)) byTopic.set(snap.topic, snap);
  }
  return [...byTopic.values()].slice(0, 8).map((snap) => {
    const key = SUBJECT_KEY[snap.subject?.toLowerCase()] ?? null;
    const pct = Math.round((snap.accuracy ?? 0) * 100);
    return {
      subject: snap.topic,
      Physics: key === "Physics" ? pct : 0,
      Chemistry: key === "Chemistry" ? pct : 0,
      Math: key === "Math" ? pct : 0,
      fullMark: 100,
    };
  });
}

export function AnalyticsCenterHighFidelity({ workspaceId, batchId }: Props) {
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [radarData, setRadarData] = useState<RadarRow[]>([]);
  const [weakConcepts, setWeakConcepts] = useState<TopicSnapshot[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const base = `/api/teacher/workspaces/${workspaceId}/analytics/batches/${batchId}`;

  useEffect(() => {
    let cancelled = false;
    // Use a .then() chain (not a synchronously-invoked async fn) so state updates
    // land in a microtask, off the effect's synchronous path.
    Promise.all([
      apiJson<{ snapshots: TopicSnapshot[] }>(`${base}?limit=100`),
      apiJson<{ weakTopics: TopicSnapshot[] }>(`${base}?type=weak-topics`),
      apiJson<{ leaderboardHistory: LeaderboardSnap[] }>(`${base}?type=leaderboard&limit=1`),
    ])
      .then(([snapshotsRes, weakRes, leaderboardRes]) => {
        if (cancelled) return;
        if (snapshotsRes.ok) setRadarData(buildRadarData(snapshotsRes.data.snapshots ?? []));
        if (weakRes.ok) setWeakConcepts(weakRes.data.weakTopics ?? []);
        // Newest snapshot wins; entries are pre-ranked by mean percentage.
        if (leaderboardRes.ok) setLeaderboard(leaderboardRes.data.leaderboardHistory?.[0]?.entries ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  async function handleAssignRemedial(conceptId: string, conceptName: string) {
    startTransition(async () => {
      const result = await apiJson(`/api/teacher/workspaces/${workspaceId}/batches/${batchId}`, {
        method: "PATCH",
        json: { settings: { triggerRemedialWorksheet: true, conceptName } },
      });
      if (result.ok) {
        toast.success(`Remedial DPP assigned to struggling students for ${conceptName}!`);
        setWeakConcepts((prev) => prev.filter((c) => c.id !== conceptId));
      } else {
        toast.error("Failed to assign remedial DPP");
      }
    });
  }

  // Derived overview metrics (all from real data; no fabricated values).
  const averageScore =
    leaderboard.length > 0
      ? Math.round(leaderboard.reduce((sum, e) => sum + e.meanPercentage, 0) / leaderboard.length)
      : null;
  const topScore = leaderboard.length > 0 ? Math.round(leaderboard[0].meanPercentage) : null;
  // Struggling roster = ranked students with the lowest mean percentage (accuracy ASC).
  const strugglingStudents = [...leaderboard].sort((a, b) => a.meanPercentage - b.meanPercentage).slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading batch analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* OverviewMetricsBanner */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Average Score</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold">{averageScore === null ? "—" : `${averageScore}%`}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Ranked Students</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold">{leaderboard.length}</span>
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Top Score</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold">{topScore === null ? "—" : `${topScore}%`}</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Weak Concepts</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-destructive">{weakConcepts.length} Topics</span>
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: MasteryRadarChart */}
        <Card className="lg:col-span-2 border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart4 className="w-5 h-5 text-primary" /> Mastery Radar Chart
            </CardTitle>
            <CardDescription>Topic accuracy across the batch, by subject.</CardDescription>
          </CardHeader>
          <CardContent className="h-80 flex items-center justify-center p-2">
            {radarData.length === 0 ? (
              <p className="text-xs text-muted-foreground">No topic snapshots yet for this batch.</p>
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="subject" stroke="#a3a3a3" style={{ fontSize: "10px", fontWeight: "bold" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#737373" style={{ fontSize: "8px" }} />
                  <Radar name="Physics" dataKey="Physics" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} />
                  <Radar name="Chemistry" dataKey="Chemistry" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                  <Radar name="Mathematics" dataKey="Math" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Right Side: WeakConceptInterventionList */}
        <Card className="lg:col-span-1 border flex flex-col">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" /> Weak Concept Interventions
            </CardTitle>
            <CardDescription>Topics the batch is struggling with</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto divide-y pr-1">
            {weakConcepts.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground py-20">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" /> No weak concepts detected. Great job!
              </div>
            ) : (
              weakConcepts.map((concept) => (
                <div key={concept.id} className="py-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <h4 className="font-semibold text-sm">{concept.topic}</h4>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {concept.subject} · {concept.attempts} attempts
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-destructive">
                      {Math.round((concept.accuracy ?? 0) * 100)}%
                    </span>
                  </div>
                  <Button
                    onClick={() => handleAssignRemedial(concept.id, concept.topic)}
                    disabled={pending}
                    className="w-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/25 font-bold h-8 text-xs rounded-lg gap-1.5"
                  >
                    {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Assign Remedial DPP
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* StrugglingStudentsDirectory */}
      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Struggling Students Directory
          </CardTitle>
          <CardDescription>Lowest trailing-30-day mean test percentage (min 2 attempts).</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {strugglingStudents.length === 0 ? (
            <p className="p-6 text-xs text-muted-foreground">
              No ranked students yet — the leaderboard needs at least two graded attempts per student.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="p-4">Student</th>
                    <th className="p-4">Mean %</th>
                    <th className="p-4 text-center">Attempts</th>
                    <th className="p-4 text-center">Batch Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {strugglingStudents.map((student) => (
                    <tr key={student.studentId} className="hover:bg-muted/10 transition-colors">
                      <td className="p-4 font-semibold text-sm">{student.displayName}</td>
                      <td className="p-4 font-bold text-destructive">{Math.round(student.meanPercentage)}%</td>
                      <td className="p-4 text-center text-muted-foreground font-semibold">{student.attempts}</td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Award className="w-3.5 h-3.5 text-muted-foreground" /> #{student.rank}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
