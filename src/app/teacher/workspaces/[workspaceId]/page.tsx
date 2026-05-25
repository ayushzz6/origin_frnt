export const dynamic = "force-dynamic";

import Link from "next/link";
import { 
  Users, 
  FileText, 
  Tv, 
  Calendar, 
  ChevronRight, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  BookOpen
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeroControls } from "@/components/teacher/DashboardHeroControls";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";
import { listEnrollments } from "@/server/workspaces/enrollments";
import { listWorkspaceImportJobs } from "@/server/workspaces/document-import-service";
import { listTeacherRooms } from "@/server/workspaces/teacher-rooms-service";
import { listCodesForWorkspace } from "@/server/workspaces/store";
import { listTeacherTests } from "@/server/workspaces/tests-service";
import { listBatches } from "@/server/workspaces/batches";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function WorkspaceOverviewPage({ params }: Props) {
  const { workspaceId } = await params;
  const { workspace, membership } = await loadWorkspaceForRender(workspaceId);

  // Fetch all parallel overview telemetry
  const [
    enrollments,
    importJobs,
    rooms,
    codes,
    tests,
    batches
  ] = await Promise.all([
    listEnrollments(workspaceId, { status: "all" }),
    listWorkspaceImportJobs(workspaceId),
    listTeacherRooms(workspaceId),
    listCodesForWorkspace(workspaceId),
    listTeacherTests(workspaceId, { status: "all" }),
    listBatches(workspaceId, { status: "active" })
  ]);

  // Telemetry filtering
  const unassignedCount = enrollments.filter((e) => e.status === "unassigned").length;
  
  // Count OCR jobs requiring reconciliation or reviews
  const reviewRequiredImports = importJobs.filter(
    (job) => job.status === "needs_review" || job.status === "failed"
  ).length;

  // Active rooms
  const activeRooms = rooms.filter(
    (room) => room.status === "lobby" || room.status === "in_test"
  );

  const activeStudentCode = codes.find(
    (c) => c.codeType === "student_join" && c.status === "active"
  ) ?? null;

  // Timeline Schedule consolidation: upcoming tests and active sessions
  const timelineEvents = [
    ...activeRooms.map(r => ({
      id: r.id,
      title: `${r.name} (Live Study Room)`,
      time: r.startedAt ? new Date(r.startedAt).toLocaleTimeString() : "Ongoing",
      type: "room" as const,
      status: r.status,
      href: `/teacher/workspaces/${workspaceId}/rooms/${r.id}`
    })),
    ...tests.filter(t => t.status === "scheduled" || t.status === "live").map(t => ({
      id: t.id,
      title: `${t.title} (Mock Test)`,
      time: new Date(t.createdAt).toLocaleDateString(),
      type: "test" as const,
      status: t.status,
      href: `/teacher/workspaces/${workspaceId}/tests`
    }))
  ].slice(0, 5);

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fade-in">
      
      {/* WelcomeHeroPanel */}
      <div className="rounded-3xl border border-border bg-card p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Active Workspace
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-foreground">{workspace.displayName}</h1>
          <p className="text-muted-foreground text-sm max-w-lg">
            {workspace.workspaceType === "institute" ? "Coaching Institute Workspace" : "Personal Teacher Workspace"}
            {" · "}
            {workspace.city ? `${workspace.city}, ` : ""}{workspace.country}
            {" · "}
            Role: <span className="font-semibold text-foreground">{membership?.role ?? "Platform Admin"}</span>
          </p>
        </div>
        
        {/* Code Interaction Area */}
        <DashboardHeroControls workspaceId={workspaceId} activeCode={activeStudentCode} />
      </div>

      {/* ActiveAlertsGrid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {/* Unassigned Students Alert */}
        <Link href={`/teacher/workspaces/${workspaceId}/students`} className="block group">
          <Card className={`h-full border transition-all duration-300 ${
            unassignedCount > 0 
              ? "border-amber-500/30 bg-amber-500/[0.02] hover:border-amber-500/60" 
              : "border-border hover:border-primary/30"
          }`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Users className={`w-5 h-5 ${unassignedCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                {unassignedCount > 0 && (
                  <span className="bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    Pending
                  </span>
                )}
              </div>
              <CardTitle className="text-base mt-2">Student Onboarding</CardTitle>
              <CardDescription>Awaiting batch assignment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight">{unassignedCount}</span>
                <span className="text-xs text-muted-foreground">students</span>
              </div>
              {unassignedCount > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Action required: approve pending requests.
                </p>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Low Confidence Import Alert */}
        <Link href={`/teacher/workspaces/${workspaceId}/question-bag`} className="block group">
          <Card className={`h-full border transition-all duration-300 ${
            reviewRequiredImports > 0 
              ? "border-blue-500/30 bg-blue-500/[0.02] hover:border-blue-500/60" 
              : "border-border hover:border-primary/30"
          }`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <FileText className={`w-5 h-5 ${reviewRequiredImports > 0 ? "text-blue-500" : "text-muted-foreground"}`} />
                {reviewRequiredImports > 0 && (
                  <span className="bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    OCR Alert
                  </span>
                )}
              </div>
              <CardTitle className="text-base mt-2">Document Imports</CardTitle>
              <CardDescription>OCR parsing & validation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight">{reviewRequiredImports}</span>
                <span className="text-xs text-muted-foreground">reconciliation alerts</span>
              </div>
              {reviewRequiredImports > 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Unresolved questions need manual correction.
                </p>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Live Test Session Telemetry */}
        <Link href={`/teacher/workspaces/${workspaceId}/rooms`} className="block group">
          <Card className={`h-full border transition-all duration-300 ${
            activeRooms.length > 0 
              ? "border-emerald-500/30 bg-emerald-500/[0.02] hover:border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.05)]" 
              : "border-border hover:border-primary/30"
          }`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Tv className={`w-5 h-5 ${activeRooms.length > 0 ? "text-emerald-500" : "text-muted-foreground"}`} />
                {activeRooms.length > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <CardTitle className="text-base mt-2">Live Study Rooms</CardTitle>
              <CardDescription>Real-time classroom portals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight">{activeRooms.length}</span>
                <span className="text-xs text-muted-foreground">active rooms</span>
              </div>
              {activeRooms.length > 0 ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1 font-medium">
                  Live monitoring in progress. Click to join.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">No active live rooms right now.</p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* ScheduleTimeline */}
        <Card className="lg:col-span-2 border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" /> Today's Schedule
                </CardTitle>
                <CardDescription>Live study sessions, assessments, and tests</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {timelineEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-border rounded-2xl">
                <Calendar className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No events scheduled for today.</p>
                <Link href={`/teacher/workspaces/${workspaceId}/tests`} className="mt-3 text-xs text-primary font-bold hover:underline flex items-center gap-1">
                  Schedule Mock Test <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="relative pl-6 border-l border-border space-y-6">
                {timelineEvents.map((event) => (
                  <div key={event.id} className="relative group">
                    {/* Circle Node */}
                    <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-4 bg-background transition-colors ${
                      event.type === "room" ? "border-emerald-500" : "border-primary"
                    }`} />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {event.time}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          event.status === "in_test" || event.status === "live"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {event.status}
                        </span>
                      </div>
                      <Link 
                        href={event.href} 
                        className="font-semibold hover:text-primary transition-colors flex items-center gap-1.5 text-sm"
                      >
                        {event.title}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Batches Quick Overview */}
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" /> Active Batches ({batches.length})
            </CardTitle>
            <CardDescription>Overview of classroom groupings</CardDescription>
          </CardHeader>
          <CardContent>
            {batches.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No active batches yet. Create one in Batches menu.
              </div>
            ) : (
              <div className="space-y-3">
                {batches.slice(0, 4).map((batch) => (
                  <Link 
                    key={batch.id} 
                    href={`/teacher/workspaces/${workspaceId}/batches/${batch.id}`}
                    className="flex items-center justify-between p-3 border rounded-xl hover:border-primary/30 bg-muted/20 hover:bg-muted/40 transition-all group"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors">{batch.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[batch.course, batch.subject].filter(Boolean).join(" · ") || "General Study"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                        {batch.studentCount} students
                      </span>
                    </div>
                  </Link>
                ))}
                {batches.length > 4 && (
                  <Link 
                    href={`/teacher/workspaces/${workspaceId}/batches`}
                    className="block text-center text-xs text-primary font-bold hover:underline"
                  >
                    View All Batches ({batches.length})
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
