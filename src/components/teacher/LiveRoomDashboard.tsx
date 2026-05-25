"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  Clock, 
  Users, 
  Play, 
  Pause, 
  Plus, 
  Square, 
  Check, 
  ChevronRight, 
  HelpCircle,
  BarChart2,
  AlertTriangle,
  UserCheck,
  Award,
  Globe,
  Loader2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiJson } from "@/lib/teacher-client";
import type { TeacherRoomSummary } from "@/server/workspaces/types";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
  room: TeacherRoomSummary;
};

type StudentPresence = {
  id: string;
  name: string;
  status: "active" | "idle" | "submitted" | "disconnected";
  score: number;
  progress: number; // percentage of questions solved
  speedSeconds: number;
};

export function LiveRoomDashboard({ workspaceId, room: initialRoom }: Props) {
  const router = useRouter();
  const [room, setRoom] = useState(initialRoom);
  const [timeLeft, setTimeLeft] = useState<number>(3600); // 1 hour mock countdown
  const [isPaused, setIsPaused] = useState(false);
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  // Simulated live presence students
  const [students, setStudents] = useState<StudentPresence[]>([
    { id: "s-1", name: "Amit Kumar", status: "active", score: 32, progress: 80, speedSeconds: 45 },
    { id: "s-2", name: "Priya Sharma", status: "active", score: 28, progress: 73, speedSeconds: 52 },
    { id: "s-3", name: "Rohan Das", status: "idle", score: 24, progress: 60, speedSeconds: 61 },
    { id: "s-4", name: "Neha Patil", status: "submitted", score: 40, progress: 100, speedSeconds: 38 },
    { id: "s-5", name: "Karan Singh", status: "disconnected", score: 12, progress: 33, speedSeconds: 88 }
  ]);

  // Live countdown timer ticking down
  useEffect(() => {
    if (isPaused || timeLeft <= 0 || room.status === "closed") return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused, timeLeft, room.status]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Live Telemetry accuracy matrix (10 mock questions)
  const accuracyMatrix = [
    { num: 1, correctRate: 85, avgTime: 42, optionsDistribution: { a: 85, b: 5, c: 5, d: 5 } },
    { num: 2, correctRate: 72, avgTime: 58, optionsDistribution: { a: 10, b: 72, c: 10, d: 8 } },
    { num: 3, correctRate: 38, avgTime: 92, optionsDistribution: { a: 42, b: 12, c: 38, d: 8 } }, // Struggling trigger
    { num: 4, correctRate: 91, avgTime: 29, optionsDistribution: { a: 2, b: 3, c: 91, d: 4 } },
    { num: 5, correctRate: 64, avgTime: 65, optionsDistribution: { a: 12, b: 12, c: 12, d: 64 } },
    { num: 6, correctRate: 51, avgTime: 81, optionsDistribution: { a: 51, b: 24, c: 20, d: 5 } },
    { num: 7, correctRate: 24, avgTime: 110, optionsDistribution: { a: 48, b: 24, c: 18, d: 10 } }, // Struggling trigger
    { num: 8, correctRate: 78, avgTime: 49, optionsDistribution: { a: 78, b: 10, c: 10, d: 2 } },
    { num: 9, correctRate: 60, avgTime: 68, optionsDistribution: { a: 15, b: 15, c: 60, d: 10 } },
    { num: 10, correctRate: 82, avgTime: 36, optionsDistribution: { a: 4, b: 82, c: 10, d: 4 } }
  ];

  // Actions
  function togglePause() {
    setIsPaused(prev => !prev);
    toast.info(isPaused ? "Live exam resumed!" : "Live exam paused!");
  }

  function addFiveMins() {
    setTimeLeft(prev => prev + 300);
    toast.success("Added 5 minutes to exam duration!");
  }

  async function handleCloseRoom() {
    if (!confirm("Are you sure you want to end this live study room session?")) return;
    startTransition(async () => {
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/rooms/${room.id}`,
        { method: "DELETE" }
      );
      if (result.ok) {
        toast.success("Live study room closed successfully");
        setRoom(prev => ({ ...prev, status: "closed" as const }));
        router.push(`/teacher/workspaces/${workspaceId}/rooms`);
        router.refresh();
      } else {
        toast.error("Failed to close live room");
      }
    });
  }

  const activeQuestion = selectedQuestionIdx !== null ? accuracyMatrix[selectedQuestionIdx] : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* RoomHeaderWidget */}
      <div className="rounded-3xl border border-border bg-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">
              Live Session
            </span>
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Room Code: {room.id}</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">{room.name}</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary" /> {students.filter(s => s.status !== "disconnected").length} students online
          </p>
        </div>

        {/* Live ticking countdown timer */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-muted/20 px-4 py-2 border rounded-2xl w-full sm:w-auto justify-center">
            <Clock className={`w-5 h-5 text-primary ${isPaused ? "" : "animate-spin-slow"}`} />
            <span className="font-mono text-xl font-bold tracking-widest">{formatTime(timeLeft)}</span>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={togglePause} className="h-10 rounded-xl flex-1 sm:flex-initial gap-1.5 font-bold">
              {isPaused ? <Play className="w-4 h-4 text-emerald-500" /> : <Pause className="w-4 h-4 text-amber-500" />}
              {isPaused ? "Resume" : "Pause"}
            </Button>
            <Button variant="outline" size="sm" onClick={addFiveMins} className="h-10 rounded-xl flex-1 sm:flex-initial gap-1.5 font-bold">
              <Plus className="w-4 h-4" /> +5 Mins
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              disabled={pending}
              onClick={handleCloseRoom} 
              className="h-10 rounded-xl flex-1 sm:flex-initial gap-1.5 font-bold"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
              End Test
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: LiveAccuracyMatrix & Presence */}
        <div className="lg:col-span-2 space-y-6">
          {/* LiveAccuracyMatrix */}
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-primary" /> Live Accuracy Matrix
              </CardTitle>
              <CardDescription>Click a question card to audit detailed options distribution.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                {accuracyMatrix.map((item, idx) => {
                  const isStruggling = item.correctRate < 45;
                  const isExcellent = item.correctRate > 75;
                  return (
                    <div 
                      key={item.num}
                      onClick={() => setSelectedQuestionIdx(idx)}
                      className={`p-3 rounded-xl border text-center cursor-pointer transition-all duration-300 hover:scale-105 flex flex-col items-center justify-center aspect-square ${
                        isExcellent 
                          ? "border-emerald-500/20 bg-emerald-500/[0.02] hover:border-emerald-500" 
                          : isStruggling
                          ? "border-destructive/20 bg-destructive/[0.02] hover:border-destructive animate-pulse"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Q{item.num}</span>
                      <span className={`text-base font-extrabold mt-1 ${
                        isExcellent ? "text-emerald-500" : isStruggling ? "text-destructive" : "text-amber-500"
                      }`}>{item.correctRate}%</span>
                      {isStruggling && (
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-1 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* PresenceGrid */}
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" /> Student Presence Matrix
              </CardTitle>
              <CardDescription>Live proctoring tiles tracking network statuses.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {students.map((student) => (
                  <div key={student.id} className="p-3 border rounded-xl bg-card flex items-center gap-2.5">
                    {/* Status Dot */}
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      student.status === "active" 
                        ? "bg-emerald-500 animate-pulse" 
                        : student.status === "idle"
                        ? "bg-amber-500"
                        : student.status === "submitted"
                        ? "bg-gray-400"
                        : "bg-destructive animate-pulse"
                    }`} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold truncate">{student.name}</span>
                      <span className="text-[9px] text-muted-foreground capitalize">{student.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: LiveLeaderboard */}
        <div className="lg:col-span-1">
          <Card className="border h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" /> Live Leaderboard
              </CardTitle>
              <CardDescription>Real-time mock test rankings</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto divide-y pr-1">
              {students
                .sort((a, b) => b.score - a.score)
                .map((student, idx) => (
                  <div key={student.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        idx === 0 
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" 
                          : "bg-muted text-muted-foreground"
                      }`}>{idx + 1}</span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{student.name}</span>
                        <span className="text-[10px] text-muted-foreground">{student.progress}% solved · {student.speedSeconds}s/q</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-primary">{student.score} pts</span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Accuracy Matrix Detail Modal */}
      <Dialog open={selectedQuestionIdx !== null} onOpenChange={(o) => !o && setSelectedQuestionIdx(null)}>
        {activeQuestion && (
          <DialogContent className="rounded-2xl max-w-sm">
            <DialogHeader>
              <DialogTitle>Question {activeQuestion.num} Analysis</DialogTitle>
              <DialogDescription>
                Detailed audit of response distribution and attempt speeds.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="bg-muted/40 p-3.5 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Attempt Speed:</span>
                  <span className="font-bold text-foreground">{activeQuestion.avgTime} Seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Correct Option:</span>
                  <span className="font-bold text-emerald-500">Option A</span>
                </div>
              </div>

              {/* Option picks distribution graph */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Options Distribution</Label>
                <div className="space-y-2">
                  {Object.entries(activeQuestion.optionsDistribution).map(([option, percent]) => {
                    const isCorrect = option === "a";
                    return (
                      <div key={option} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className={isCorrect ? "text-emerald-500 font-bold" : ""}>
                            Option {option.toUpperCase()} {isCorrect && "(Correct)"}
                          </span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isCorrect ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeQuestion.correctRate < 45 && (
                <div className="p-3 border border-red-500/20 bg-red-500/10 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Struggling Alert:</span> More than 55% of the students have answered this question incorrectly. Recommend a post-class worksheet revision.
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => setSelectedQuestionIdx(null)} className="w-full bg-primary hover:bg-primary/95 text-black font-semibold rounded-xl">
                Close Audit
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

    </div>
  );
}
