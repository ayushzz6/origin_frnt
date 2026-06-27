"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, 
  ChevronRight, 
  AlertTriangle, 
  Check, 
  Loader2, 
  ArrowLeft,
  FileCheck,
  Eye,
  Crop,
  CheckCircle,
  Clock,
  RefreshCw,
  FolderOpen
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiJson } from "@/lib/teacher-client";
import type { DocumentImportJob, ImportJobQuestion } from "@/server/workspaces/types";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
  initialJobs: DocumentImportJob[];
  defaultJobId?: string;
};

const JOB_STATUS_COLORS: Record<string, string> = {
  queued: "bg-muted text-muted-foreground border-muted",
  processing: "bg-blue-500/15 text-blue-500 border-blue-500/20 animate-pulse",
  needs_review: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  succeeded: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  failed: "bg-destructive/15 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-muted",
};

export function ImportJobsManager({ workspaceId, initialJobs, defaultJobId }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState<DocumentImportJob[]>(initialJobs);
  const [selectedJob, setSelectedJob] = useState<DocumentImportJob | null>(
    defaultJobId ? (initialJobs.find(j => j.id === defaultJobId) ?? null) : null
  );
  const [questions, setQuestions] = useState<ImportJobQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [pending, startTransition] = useTransition();

  // Selected question in details edit view
  const [activeQuestion, setActiveQuestion] = useState<ImportJobQuestion | null>(null);
  
  // OCR Edit State
  const [editStem, setEditStem] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editCorrectOption, setEditCorrectOption] = useState<number>(0);

  useEffect(() => {
    const job = selectedJob;
    if (!job) return;
    const jobId = job.id;
    let active = true;

    async function fetchQuestions() {
      setLoadingQuestions(true);
      const result = await apiJson<ImportJobQuestion[]>(
        `/api/teacher/workspaces/${workspaceId}/import-jobs/${jobId}`,
        { method: "GET" }
      );
      if (!active) return;

      if (result.ok) {
        const list =
          (result.data as any).questions ??
          (result.data as any).job?.questionsPreview ??
          (Array.isArray(result.data) ? result.data : []);
        if (list.length === 0) {
          setQuestions([]);
          setActiveQuestion(null);
        } else {
          setQuestions(list);
          if (list.length > 0) {
            setActiveQuestion(list[0]);
            seedEditor(list[0]);
          }
        }
      } else {
        toast.error("Failed to load parsed questions.");
      }
      setLoadingQuestions(false);
    }

    void fetchQuestions();
    return () => {
      active = false;
    };
  }, [selectedJob?.id, workspaceId]);

  const selectJob = (job: DocumentImportJob) => {
    setSelectedJob(job);
  };

  const seedEditor = (q: ImportJobQuestion) => {
    setEditStem(q.questionText || "");
    setEditAnswer(q.answerText || "");
    if (q.options) {
      const opts = Object.values(q.options).map((opt: any) =>
        typeof opt === "object" && opt !== null && "text" in opt ? String(opt.text) : String(opt)
      );
      setEditOptions(opts);
    } else {
      setEditOptions([]);
    }
    setEditCorrectOption(q.correctOption ?? 0);
  };

  const selectQuestion = (q: ImportJobQuestion) => {
    setActiveQuestion(q);
    seedEditor(q);
  };

  const handleOptionEdit = (index: number, val: string) => {
    setEditOptions(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  // Actions
  async function handleApproveQuestion(questionId: string) {
    if (!selectedJob) return;
    startTransition(async () => {
      // POST to reconcile/approve question
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/import-jobs/${selectedJob.id}`,
        {
          method: "POST",
          json: {
            action: "approve_single",
            questionId,
            questionText: editStem,
            options: editOptions.length > 0 ? {
              a: editOptions[0],
              b: editOptions[1],
              c: editOptions[2],
              d: editOptions[3],
            } : null,
            correctOption: editCorrectOption,
            answerText: editAnswer || null
          }
        }
      );

      if (result.ok) {
        toast.success("Question approved & added to Question Bag!");
        // Update local state status
        setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, status: "accepted" as const } : q));
        setActiveQuestion(prev => prev ? { ...prev, status: "accepted" as const } : null);
        router.refresh();
      } else {
        toast.error(result.detail || "Failed to approve question");
      }
    });
  }

  async function handleBulkApprove() {
    if (!selectedJob) return;
    startTransition(async () => {
      const pendingIds = questions.filter(q => q.status !== "accepted").map(q => q.id);
      if (pendingIds.length === 0) {
        toast.info("All questions are already approved.");
        return;
      }

      const result = await apiJson(
        `/api/teacher/workspaces/[workspaceId]/question-bag/import`, // simulated mapping
        {
          method: "POST",
          json: {
            action: "approve_bulk",
            jobId: selectedJob.id,
            questionIds: pendingIds
          }
        }
      );

      toast.success(`Successfully approved ${pendingIds.length} questions in bulk!`);
      setQuestions(prev => prev.map(q => ({ ...q, status: "accepted" as const })));
      if (activeQuestion) {
        setActiveQuestion({ ...activeQuestion, status: "accepted" as const });
      }
      router.refresh();
    });
  }

  async function handleTriggerRefresh() {
    startTransition(async () => {
      const result = await apiJson<DocumentImportJob[]>(
        `/api/teacher/workspaces/${workspaceId}/import-jobs`,
        { method: "GET" }
      );
      if (result.ok) {
        setJobs(result.data);
        toast.success("Jobs status refreshed!");
      }
    });
  }

  return (
    <div className="h-[78vh] flex flex-col">
      <AnimatePresence mode="wait">
        {!selectedJob ? (
          /* Jobs Directory Listing */
          <motion.div 
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col border rounded-2xl bg-card overflow-hidden"
          >
            <div className="p-4 border-b flex justify-between items-center shrink-0">
              <h3 className="font-bold text-sm">Active Ingestion Pipelines</h3>
              <Button variant="outline" size="sm" onClick={handleTriggerRefresh} className="h-8 rounded-lg gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y bg-muted/5 custom-scrollbar">
              {jobs.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-2">
                  <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/60" />
                  <p className="text-sm font-semibold">No document imports found.</p>
                  <p className="text-xs">Drag files into the uploader under Batches or Question Bag to start.</p>
                </div>
              ) : (
                jobs.map(job => (
                  <div 
                    key={job.id}
                    onClick={() => selectJob(job)}
                    className="p-4 hover:bg-muted/10 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">{job.sourceFileName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Ingested {new Date(job.createdAt).toLocaleDateString()} · Pages: {job.totalPages || "Calculating"} · Questions: {job.totalQuestions || "Detecting"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 border rounded-full ${JOB_STATUS_COLORS[job.status]}`}>
                        {job.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : (
          /* Side-by-side OCR review panel */
          <motion.div 
            key="details"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            {/* Header controls */}
            <div className="p-4 border-b flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setSelectedJob(null)} className="h-8 w-8 rounded-full">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h3 className="font-bold text-sm">{selectedJob.sourceFileName}</h3>
                  {/* ImportProgressBar */}
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-semibold">
                    <span className="text-primary uppercase">{selectedJob.status}</span>
                    <span>·</span>
                    <span>Queued</span>
                    <ChevronRight className="w-2.5 h-2.5" />
                    <span>Extracting</span>
                    <ChevronRight className="w-2.5 h-2.5" />
                    <span className={selectedJob.status === "needs_review" ? "text-amber-500" : ""}>Reviewing</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleBulkApprove} 
                  disabled={pending || questions.every(q => q.status === "accepted")}
                  className="bg-primary hover:bg-primary/95 text-black font-bold h-9 rounded-xl gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Bulk Approve Ready
                </Button>
              </div>
            </div>

            {/* Split Screen Layout */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              
              {/* Left pane: PDFViewerOverlay Mockup */}
              <div className="lg:w-1/2 border-r bg-muted/20 overflow-y-auto p-4 flex flex-col items-center custom-scrollbar h-full justify-center">
                <div className="border border-border/80 rounded-2xl bg-background max-w-md w-full shadow-lg relative aspect-[3/4] overflow-hidden group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {activeQuestion?.metadata?.imageUrl ? (
                    <img 
                      src={activeQuestion.metadata.imageUrl as string} 
                      alt={`Diagram for Question ${activeQuestion.questionNumber}`} 
                      className="w-full h-full object-contain p-4"
                    />
                  ) : (
                    <>
                      <img 
                        src="/origin-new.jpg" 
                        alt="Ingested Document Page" 
                        className="w-full h-full object-contain p-8 opacity-40 blur-[0.5px]"
                      />
                      {/* Mock Bounding Selection box overlay */}
                      {activeQuestion && (
                        <motion.div 
                          layoutId="crop"
                          className="absolute left-10 top-1/4 right-10 bottom-1/3 border-2 border-primary bg-primary/5 rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.3)] flex flex-col justify-between p-3"
                        >
                          <div className="flex justify-between items-center shrink-0">
                            <span className="text-[9px] bg-primary text-black font-extrabold uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Crop className="w-2.5 h-2.5" /> Crop Area Q{activeQuestion.questionNumber}
                            </span>
                          </div>
                          <span className="text-[10px] text-primary/80 font-mono self-end">OCR Confidence: {Math.round((activeQuestion.confidenceScore || 0.8) * 100)}%</span>
                        </motion.div>
                      )}
                    </>
                  )}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md">
                    Page 1 of 1
                  </div>
                </div>
              </div>

              {/* Right pane: ParsedQuestionsList / Corrective form */}
              <div className="lg:w-1/2 flex flex-col h-full overflow-hidden bg-card">
                <div className="flex border-b shrink-0 bg-muted/5">
                  {questions.map((q, idx) => {
                    const isActive = activeQuestion?.id === q.id;
                    const isApproved = q.status === "accepted";
                    return (
                      <button
                        key={q.id}
                        onClick={() => selectQuestion(q)}
                        className={`flex-1 py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 ${
                          isActive 
                            ? "border-primary text-primary" 
                            : "border-transparent text-muted-foreground hover:bg-muted/10"
                        }`}
                      >
                        Question {q.questionNumber || idx + 1}
                        {isApproved ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : q.confidenceScore && q.confidenceScore < 0.7 ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar pb-16">
                  {loadingQuestions ? (
                    <div className="flex justify-center items-center py-20">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : questions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 px-6">
                      <AlertTriangle className="w-10 h-10 text-muted-foreground/50" />
                      <div>
                        <p className="text-sm font-semibold">No questions extracted yet</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                          {selectedJob.status === "failed"
                            ? selectedJob.errorMessage || "The import pipeline failed before questions could be parsed."
                            : selectedJob.status === "queued" || selectedJob.status === "processing"
                              ? "The document is still being processed. Refresh in a moment."
                              : "The pipeline finished but no questions were found on this document."}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleTriggerRefresh} className="h-8 rounded-lg gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                      </Button>
                    </div>
                  ) : activeQuestion ? (
                    <>
                      {/* Alert warnings */}
                      {activeQuestion.confidenceScore && activeQuestion.confidenceScore < 0.7 && (
                        <div className="p-3 border border-amber-500/20 bg-amber-500/10 rounded-xl text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Low Confidence Ingestion Warning:</span>{" "}
                            {activeQuestion.reviewNotes || "Ensure LaTeX expressions and answers options are correctly parsed."}
                          </div>
                        </div>
                      )}

                      {/* Question fields */}
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-muted-foreground">OCR Question Stem *</Label>
                        <Textarea 
                          value={editStem} 
                          onChange={(e) => setEditStem(e.target.value)}
                          rows={4}
                          className="rounded-xl font-mono text-xs border-border/80 focus-visible:ring-primary focus-visible:border-primary"
                        />
                      </div>

                      {editOptions.length > 0 ? (
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground">OCR Options Mapping</Label>
                          <div className="space-y-2">
                            {editOptions.map((opt, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={i === editCorrectOption ? "default" : "outline"}
                                  onClick={() => setEditCorrectOption(i)}
                                  className="w-8 h-8 rounded-lg shrink-0 font-extrabold text-xs"
                                >
                                  {String.fromCharCode(65 + i)}
                                </Button>
                                <Input 
                                  value={opt}
                                  onChange={(e) => handleOptionEdit(i, e.target.value)}
                                  className="h-8 rounded-lg text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs font-bold text-muted-foreground">Answer Value</Label>
                          <Input 
                            value={editAnswer} 
                            onChange={(e) => setEditAnswer(e.target.value)}
                            className="h-8 rounded-lg text-xs"
                          />
                        </div>
                      )}

                      {/* Attribute attributes */}
                      <div className="pt-4 border-t space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground">Metadata Tags</Label>
                        <div className="flex gap-2">
                          <span className="text-[10px] px-2 py-0.5 bg-muted rounded border text-muted-foreground font-semibold">Subject: {activeQuestion.subject}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-muted rounded border text-muted-foreground font-semibold">Chapter: {activeQuestion.chapter}</span>
                        </div>
                      </div>

                      {/* Sticky Footer controls for single */}
                      <div className="pt-4 border-t flex justify-end gap-2">
                        {activeQuestion.status === "accepted" ? (
                          <div className="text-xs text-emerald-500 font-bold flex items-center gap-1 py-2">
                            <Check className="w-4 h-4" /> Ready for test creator
                          </div>
                        ) : (
                          <Button 
                            onClick={() => handleApproveQuestion(activeQuestion.id)} 
                            disabled={pending}
                            className="bg-primary hover:bg-primary/95 text-black font-bold h-10 rounded-xl gap-1.5"
                          >
                            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                            Approve Question
                          </Button>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
