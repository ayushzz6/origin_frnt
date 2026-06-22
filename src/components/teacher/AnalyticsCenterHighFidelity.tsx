"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  BarChart4,
  Check,
  Loader2,
  AlertTriangle,
  Award,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  covered: boolean;
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

// One topic row of a single student's profile (analytics/students/[studentId]).
type StudentTopicProfileRow = {
  topic: string;
  subject: string;
  chapter: string | null;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number; // 0–1
  masteryScore: number; // 0–1
  lastAttemptAt: string | null;
};

type RadarRow = {
  topic: string;
  needsCoverage: number;
  covered: number;
  fullMark: number;
};

/**
 * One radar spoke per topic (cap 8). A topic's accuracy plots on the green
 * "Covered" series when the teacher has marked it covered, otherwise on the red
 * "Needs coverage" series — so the radar flips live as boxes are ticked.
 */
function buildRadarData(snapshots: TopicSnapshot[]): RadarRow[] {
  const byTopic = new Map<string, TopicSnapshot>();
  for (const snap of snapshots) {
    if (!byTopic.has(snap.topic)) byTopic.set(snap.topic, snap);
  }
  return [...byTopic.values()].slice(0, 8).map((snap) => {
    const pct = Math.round((snap.accuracy ?? 0) * 100);
    return {
      topic: snap.topic,
      needsCoverage: snap.covered ? 0 : pct,
      covered: snap.covered ? pct : 0,
      fullMark: 100,
    };
  });
}

export function AnalyticsCenterHighFidelity({ workspaceId, batchId }: Props) {
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<TopicSnapshot[]>([]);
  const [weakConcepts, setWeakConcepts] = useState<TopicSnapshot[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  // Individual-participant drill-down (analytics/students/[studentId]).
  const [selectedStudent, setSelectedStudent] = useState<LeaderboardEntry | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentTopicProfileRow[] | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const base = `/api/teacher/workspaces/${workspaceId}/analytics/batches/${batchId}`;
  // Radar re-derives whenever a coverage toggle updates the snapshots.
  const radarData = useMemo(() => buildRadarData(snapshots), [snapshots]);

  async function openStudent(entry: LeaderboardEntry) {
    setSelectedStudent(entry);
    setStudentProfile(null);
    setProfileLoading(true);
    const res = await apiJson<{ profiles: StudentTopicProfileRow[] }>(
      `/api/teacher/workspaces/${workspaceId}/analytics/students/${entry.studentId}`,
    );
    setProfileLoading(false);
    setStudentProfile(res.ok ? res.data.profiles ?? [] : []);
  }

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
        if (snapshotsRes.ok) setSnapshots(snapshotsRes.data.snapshots ?? []);
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

  // Mark a weak topic covered/uncovered for the next class. Persisted per batch so
  // it survives a refresh; the radar spoke flips red↔green from the same state.
  async function toggleCovered(concept: TopicSnapshot, next: boolean) {
    const flip = (covered: boolean) => {
      setWeakConcepts((prev) => prev.map((c) => (c.id === concept.id ? { ...c, covered } : c)));
      setSnapshots((prev) =>
        prev.map((s) =>
          s.subject === concept.subject && s.topic === concept.topic ? { ...s, covered } : s,
        ),
      );
    };
    flip(next); // optimistic
    const result = await apiJson(`${base}/coverage`, {
      method: "PATCH",
      json: { subject: concept.subject, topic: concept.topic, covered: next },
    });
    if (!result.ok) {
      flip(!next); // revert on failure
      toast.error("Failed to update coverage");
    }
  }

  // Derived overview metrics (all from real data; no fabricated values).
  const averageScore =
    leaderboard.length > 0
      ? Math.round(leaderboard.reduce((sum, e) => sum + e.meanPercentage, 0) / leaderboard.length)
      : null;
  const topScore = leaderboard.length > 0 ? Math.round(leaderboard[0].meanPercentage) : null;
  // Weak-concept count reflects what's still UNcovered (so it falls as topics are ticked).
  const uncoveredWeakCount = weakConcepts.filter((c) => !c.covered).length;
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
              <span className="text-2xl font-bold text-destructive">{uncoveredWeakCount} Topics</span>
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
            <CardDescription>
              Topic accuracy across the batch. <span className="text-emerald-500">Green = covered</span> in the next
              class, <span className="text-destructive">red = still to cover</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80 flex items-center justify-center p-2">
            {radarData.length === 0 ? (
              <p className="text-xs text-muted-foreground">No topic snapshots yet for this batch.</p>
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="topic" stroke="#a3a3a3" style={{ fontSize: "10px", fontWeight: "bold" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#737373" style={{ fontSize: "8px" }} />
                  <Radar name="Needs coverage" dataKey="needsCoverage" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                  <Radar name="Covered" dataKey="covered" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Right Side: WeakConceptInterventionList */}
        <Card className="lg:col-span-1 border flex flex-col">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" /> Weak Concepts
            </CardTitle>
            <CardDescription>Tick a topic once you&apos;ve covered it in your next class.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto divide-y pr-1">
            {weakConcepts.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground py-20">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" /> No weak concepts detected. Great job!
              </div>
            ) : (
              weakConcepts.map((concept) => (
                <label
                  key={concept.id}
                  htmlFor={`cov-${concept.id}`}
                  className="flex items-start justify-between gap-3 py-4 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`cov-${concept.id}`}
                      checked={concept.covered}
                      onCheckedChange={(v) => toggleCovered(concept, v === true)}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <h4
                        className={`font-semibold text-sm ${
                          concept.covered ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {concept.topic}
                      </h4>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {concept.subject} · {concept.attempts} attempts{concept.covered ? " · covered" : ""}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-mono font-bold ${
                      concept.covered ? "text-emerald-500" : "text-destructive"
                    }`}
                  >
                    {Math.round((concept.accuracy ?? 0) * 100)}%
                  </span>
                </label>
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
                    <tr
                      key={student.studentId}
                      onClick={() => openStudent(student)}
                      className="cursor-pointer hover:bg-muted/10 transition-colors"
                    >
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

      {/* BatchLeaderboard — full ranking, click a row to drill into a participant */}
      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" /> Batch Leaderboard
          </CardTitle>
          <CardDescription>
            Ranked by trailing-30-day mean test percentage. Click a student to see their individual analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {leaderboard.length === 0 ? (
            <p className="p-6 text-xs text-muted-foreground">
              No ranked students yet — the leaderboard needs at least two graded attempts per student.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="p-4 text-center">Rank</th>
                    <th className="p-4">Student</th>
                    <th className="p-4">Mean %</th>
                    <th className="p-4 text-center">Attempts</th>
                    <th className="p-4 text-center">Platform Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {leaderboard.map((student) => (
                    <tr
                      key={student.studentId}
                      onClick={() => openStudent(student)}
                      className={`cursor-pointer transition-colors ${
                        selectedStudent?.studentId === student.studentId ? "bg-primary/10" : "hover:bg-muted/10"
                      }`}
                    >
                      <td className="p-4 text-center font-bold">#{student.rank}</td>
                      <td className="p-4 font-semibold text-sm">{student.displayName}</td>
                      <td className="p-4 font-bold">{Math.round(student.meanPercentage)}%</td>
                      <td className="p-4 text-center text-muted-foreground font-semibold">{student.attempts}</td>
                      <td className="p-4 text-center text-muted-foreground">
                        {student.platformRank > 0 ? `#${student.platformRank}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* IndividualParticipantAnalytics — per-student topic profile drill-down */}
      {selectedStudent ? (
        <Card className="border border-primary/30">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" /> {selectedStudent.displayName} — Individual Analytics
                </CardTitle>
                <CardDescription>
                  Mean {Math.round(selectedStudent.meanPercentage)}% · {selectedStudent.attempts} attempts · batch rank
                  #{selectedStudent.rank}. Topics ordered weakest first.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setSelectedStudent(null);
                  setStudentProfile(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {profileLoading ? (
              <div className="flex items-center gap-2 p-6 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading individual analytics…
              </div>
            ) : !studentProfile || studentProfile.length === 0 ? (
              <p className="p-6 text-xs text-muted-foreground">
                No topic-level analytics yet for this student. Profiles populate after they submit a graded test in
                this batch.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="p-4">Topic</th>
                      <th className="p-4">Subject</th>
                      <th className="p-4 text-center">Accuracy</th>
                      <th className="p-4 text-center">Attempts</th>
                      <th className="p-4 text-center">Mastery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {studentProfile.map((row) => {
                      const acc = Math.round((row.accuracy ?? 0) * 100);
                      return (
                        <tr key={`${row.subject}-${row.topic}`} className="hover:bg-muted/10 transition-colors">
                          <td className="p-4 font-semibold text-sm">{row.topic}</td>
                          <td className="p-4 capitalize text-muted-foreground">{row.subject}</td>
                          <td
                            className={`p-4 text-center font-bold ${
                              acc < 50 ? "text-destructive" : acc < 75 ? "text-amber-500" : "text-emerald-500"
                            }`}
                          >
                            {acc}%
                          </td>
                          <td className="p-4 text-center text-muted-foreground font-semibold">
                            {row.correctAttempts}/{row.totalAttempts}
                          </td>
                          <td className="p-4 text-center text-muted-foreground">
                            {Math.round((row.masteryScore ?? 0) * 100)}%
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
      ) : null}
    </div>
  );
}
