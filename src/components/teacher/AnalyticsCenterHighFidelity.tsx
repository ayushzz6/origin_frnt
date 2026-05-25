"use client";

import { useState, useTransition } from "react";
import { 
  TrendingDown, 
  BookOpen, 
  Users, 
  BarChart4, 
  AlertCircle, 
  Check, 
  Sparkles,
  ChevronRight,
  TrendingUp,
  Activity,
  Award,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar 
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiJson } from "@/lib/teacher-client";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
  batchId: string;
};

export function AnalyticsCenterHighFidelity({ workspaceId, batchId }: Props) {
  const [pending, startTransition] = useTransition();

  // Radar Chart mock data matching JEE/NEET subjects
  const radarData = [
    { subject: "Mechanics", Physics: 75, Chemistry: 20, Math: 30, fullMark: 100 },
    { subject: "Electrostatics", Physics: 82, Chemistry: 10, Math: 20, fullMark: 100 },
    { subject: "Organic Chem", Physics: 10, Chemistry: 85, Math: 10, fullMark: 100 },
    { subject: "Inorganic Chem", Physics: 15, Chemistry: 68, Math: 10, fullMark: 100 },
    { subject: "Calculus", Physics: 30, Chemistry: 10, Math: 78, fullMark: 100 },
    { subject: "Algebra", Physics: 20, Chemistry: 5, Math: 91, fullMark: 100 },
  ];

  // Weak concept list (< 55% accuracy)
  const [weakConcepts, setWeakConcepts] = useState([
    { id: "wc-1", name: "Rotational Inertia & Torque", subject: "Physics", accuracy: 42, strugglingStudents: 4 },
    { id: "wc-2", name: "Aldehydes & Ketones Syntheses", subject: "Chemistry", accuracy: 38, strugglingStudents: 5 },
    { id: "wc-3", name: "Definite Integration Limits", subject: "Mathematics", accuracy: 51, strugglingStudents: 3 }
  ]);

  // Roster listing students with declining performance (sparklines)
  const strugglingStudents = [
    { id: "s-1", name: "Amit Kumar", change: -12, testsCount: 8, consistency: "75%", sparkline: "M0 10 L10 12 L20 18 L30 25 L40 28" },
    { id: "s-2", name: "Rohan Das", change: -8, testsCount: 7, consistency: "68%", sparkline: "M0 8 L10 10 L20 15 L30 14 L40 22" },
    { id: "s-3", name: "Karan Singh", change: -15, testsCount: 6, consistency: "50%", sparkline: "M0 5 L10 12 L20 20 L30 28 L40 35" }
  ];

  async function handleAssignRemedial(conceptId: string, conceptName: string) {
    startTransition(async () => {
      // POST request to trigger dynamic remedial DPP generation
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/batches/${batchId}`,
        {
          method: "PATCH",
          json: {
            settings: { triggerRemedialWorksheet: true, conceptName }
          }
        }
      );

      if (result.ok) {
        toast.success(`Remedial DPP assigned to struggling students for ${conceptName}!`);
        // Remove from list locally for visual responsiveness
        setWeakConcepts(prev => prev.filter(c => c.id !== conceptId));
      } else {
        toast.error("Failed to assign remedial DPP");
      }
    });
  }

  return (
    <div className="space-y-6">
      
      {/* OverviewMetricsBanner */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Average Score</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold">64.2%</span>
              <span className="text-[10px] text-emerald-500 font-bold flex items-center"><TrendingUp className="w-3 h-3" /> +2.4%</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Syllabus Pacing</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold">On Track</span>
              <span className="text-[10px] text-primary font-bold">Week 12</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Attendance Rate</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold">92.4%</span>
              <span className="text-[10px] text-muted-foreground font-semibold">Average</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-card">
          <CardContent className="p-4 flex flex-col justify-between h-24">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Weak Concepts</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-destructive">{weakConcepts.length} Topics</span>
              <span className="text-[10px] text-destructive font-bold flex items-center"><AlertTriangle className="w-3.5 h-3.5" /> critical</span>
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
            <CardDescription>Multi-axis radar comparing topic accuracy metrics across disciplines.</CardDescription>
          </CardHeader>
          <CardContent className="h-80 flex items-center justify-center p-2">
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
          </CardContent>
        </Card>

        {/* Right Side: WeakConceptInterventionList */}
        <Card className="lg:col-span-1 border flex flex-col">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" /> Weak Concept Interventions
            </CardTitle>
            <CardDescription>Topics scoring below 55% accuracy</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto divide-y pr-1">
            {weakConcepts.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground py-20">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" /> All concepts score above 55%. Great job!
              </div>
            ) : (
              weakConcepts.map((concept) => (
                <div key={concept.id} className="py-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <h4 className="font-semibold text-sm">{concept.name}</h4>
                      <p className="text-[10px] text-muted-foreground">{concept.subject} · {concept.strugglingStudents} struggling students</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-destructive">{concept.accuracy}%</span>
                  </div>
                  <Button 
                    onClick={() => handleAssignRemedial(concept.id, concept.name)}
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
          <CardDescription>Roster tracking students with declining test margins.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="p-4">Student</th>
                  <th className="p-4">Margins Decline</th>
                  <th className="p-4 text-center">Sparkline (5 Tests)</th>
                  <th className="p-4">Consistency</th>
                  <th className="p-4 w-12">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {strugglingStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4 font-semibold text-sm">{student.name}</td>
                    <td className="p-4 text-destructive font-bold flex items-center gap-1.5">
                      <TrendingDown className="w-4 h-4" /> {student.change}%
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-block h-6 w-16">
                        <svg className="w-full h-full" viewBox="0 0 40 40">
                          {/* Simulated sparkline path */}
                          <path 
                            d={student.sparkline} 
                            fill="none" 
                            stroke="#ef4444" 
                            strokeWidth="2" 
                          />
                        </svg>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground font-semibold">{student.consistency}</td>
                    <td className="p-4 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
