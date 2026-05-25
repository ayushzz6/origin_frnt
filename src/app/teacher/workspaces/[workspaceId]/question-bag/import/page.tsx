export const dynamic = "force-dynamic";

/**
 * Phase 10 — import upload + job list.
 *
 * Server component: loads the job list from the document-import store
 * and hands it to a small client island that runs the upload form.
 */

import Link from "next/link";
import { ArrowLeft, FileText, Database, ShieldAlert, Sparkles, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImportUploadForm } from "@/components/teacher/import/ImportUploadForm";
import { listWorkspaceImportJobs } from "@/server/workspaces/document-import-service";
import { loadWorkspaceForRender } from "@/server/workspaces/server-loader";
import type { ImportJobStatus } from "@/server/workspaces/types";

const STATUS_LABEL: Record<ImportJobStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  needs_review: "Needs review",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_VARIANT: Record<
  ImportJobStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  queued: "outline",
  processing: "secondary",
  needs_review: "default",
  succeeded: "default",
  failed: "destructive",
  cancelled: "outline",
};

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function ImportLandingPage({ params }: Props) {
  const { workspaceId } = await params;
  const { membership, isPlatformAdmin } = await loadWorkspaceForRender(workspaceId);
  const canImport =
    isPlatformAdmin ||
    membership?.role === "owner" ||
    membership?.role === "admin" ||
    membership?.role === "teacher" ||
    membership?.role === "content_manager";

  const jobs = await listWorkspaceImportJobs(workspaceId, { limit: 25 });

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1 uppercase tracking-wider">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Ingestion Pipeline
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
            Document Import
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
            Upload question papers (PDF, DOCX, or images). The AI engine automatically parses, structure-classifies, and extracts question batches for verification.
          </p>
        </div>
        <div>
          <Button asChild variant="outline" className="rounded-xl h-10 border-border hover:bg-secondary/40">
            <Link href={`/teacher/workspaces/${workspaceId}/question-bag`} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Question Bag
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Upload Form */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="premium-card bg-card/40 backdrop-blur-xl border border-border/80 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/80 to-primary/20" />
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Upload Document
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Process questions into private drafts or submit for public database moderation. Files are secured in R2.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canImport ? (
                <ImportUploadForm workspaceId={workspaceId} />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 bg-destructive/5 rounded-xl border border-destructive/20">
                  <ShieldAlert className="h-10 w-10 text-destructive" />
                  <div>
                    <h3 className="text-sm font-semibold">Access Denied</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your workspace role does not have authorization to trigger document ingestion.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Ingestion Status Table */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="premium-card bg-card/20 backdrop-blur-xl border border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Recent Ingestion Jobs
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Monitor parsing progress, OCR statuses, and review candidate questions.
                </CardDescription>
              </div>
              <span className="text-xs text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-full border border-border">
                {jobs.length} total
              </span>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 border border-dashed border-border rounded-xl">
                  <FileText className="h-12 w-12 text-muted-foreground/30 animate-pulse" />
                  <div>
                    <h3 className="text-sm font-semibold">No import jobs</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Upload a question paper in the panel to begin automated extraction.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/80 bg-background/50">
                  <Table>
                    <TableHeader className="bg-secondary/40">
                      <TableRow>
                        <TableHead className="font-semibold text-xs py-3">File Name</TableHead>
                        <TableHead className="font-semibold text-xs py-3">Target</TableHead>
                        <TableHead className="font-semibold text-xs py-3">Status</TableHead>
                        <TableHead className="font-semibold text-xs py-3">Stage</TableHead>
                        <TableHead className="font-semibold text-xs py-3 text-right">Extracted Qs</TableHead>
                        <TableHead className="font-semibold text-xs py-3 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job.id} className="hover:bg-secondary/20 transition-colors">
                          <TableCell className="font-mono text-xs max-w-[150px] truncate" title={job.sourceFileName}>
                            {job.sourceFileName}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                              {job.targetSurface === "question_bag" ? "Private Bag" : "OGCode Draft"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={STATUS_VARIANT[job.status]} 
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                                job.status === "needs_review" 
                                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                  : job.status === "processing" 
                                  ? "bg-sky-500/10 text-sky-500 border-sky-500/20 animate-pulse"
                                  : ""
                              }`}
                            >
                              {STATUS_LABEL[job.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground capitalize">
                            {job.stage.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold">
                            {job.acceptedQuestions + job.reviewRequiredQuestions} / {job.totalQuestions ?? "?"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant={job.status === "needs_review" ? "default" : "outline"} className="h-8 rounded-lg text-xs font-semibold">
                              <Link
                                href={`/teacher/workspaces/${workspaceId}/question-bag/import/${job.id}`}
                              >
                                {job.status === "needs_review" ? "Review" : "View"}
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
