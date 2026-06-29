"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
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
  const [showFinishModal, setShowFinishModal] = useState(false);

  // Selected question in details edit view
  const [activeQuestion, setActiveQuestion] = useState<ImportJobQuestion | null>(null);
  
  // OCR Edit State
  const [editStem, setEditStem] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editCorrectOption, setEditCorrectOption] = useState<number>(0);
  // Classification (subject / chapter / topic / difficulty) — editable so the
  // teacher can segregate like OG Code before approving.
  const [editSubject, setEditSubject] = useState("");
  const [editChapter, setEditChapter] = useState("");
  const [editConcept, setEditConcept] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<"easy" | "medium" | "hard" | "insane">("medium");
  const [bulkSubject, setBulkSubject] = useState("");

  // Mirror the active question into a ref so the poller can decide whether to
  // re-seed the editor without clobbering the teacher's in-progress edits.
  const activeQuestionRef = useRef<ImportJobQuestion | null>(null);
  useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

  const seedEditor = useCallback((q: ImportJobQuestion) => {
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
    setEditSubject(q.subject || "");
    setEditChapter(q.chapter || "");
    setEditConcept(q.concept || "");
    const diff = (q.difficulty || "medium") as "easy" | "medium" | "hard" | "insane";
    setEditDifficulty(["easy", "medium", "hard", "insane"].includes(diff) ? diff : "medium");
  }, []);

  const loadQuestions = useCallback(
    async (jobId: string) => {
      setLoadingQuestions(true);
      const result = await apiJson<{
        questions?: ImportJobQuestion[];
        job?: { questionsPreview?: ImportJobQuestion[] };
      }>(
        `/api/teacher/workspaces/${workspaceId}/import-jobs/${jobId}?type=questions`,
        { method: "GET" }
      );
      if (result.ok) {
        const list =
          result.data.questions ??
          result.data.job?.questionsPreview ??
          (Array.isArray(result.data) ? result.data : []);
        setQuestions(list);
        const current = activeQuestionRef.current;
        const stillThere = current ? list.find((q) => q.id === current.id) : undefined;
        if (stillThere) {
          // Same question still present — refresh its stored copy but DON'T
          // re-seed the editor (would wipe unsaved edits).
          setActiveQuestion(stillThere);
        } else {
          const first = list[0] ?? null;
          setActiveQuestion(first);
          if (first) seedEditor(first);
        }
      } else {
        toast.error("Failed to load parsed questions.");
      }
      setLoadingQuestions(false);
    },
    [workspaceId, seedEditor],
  );

  // Load parsed questions whenever a different job is opened.
  useEffect(() => {
    const job = selectedJob;
    if (!job) return;
    void loadQuestions(job.id);
  }, [selectedJob?.id, loadQuestions]);

  // While a job is still running, poll its status so the progress stepper
  // animates Queued → Extracting → Reviewing without a manual refresh, and
  // auto-load the questions the moment it reaches review.
  useEffect(() => {
    const job = selectedJob;
    if (!job) return;
    const isTerminal = (s: string) =>
      ["needs_review", "succeeded", "failed", "cancelled"].includes(s);
    if (isTerminal(job.status)) return;

    let active = true;
    const interval = setInterval(async () => {
      const result = await apiJson<{ job?: DocumentImportJob }>(
        `/api/teacher/workspaces/${workspaceId}/import-jobs/${job.id}`,
        { method: "GET" },
      );
      if (!active) return;
      const updated = result.ok ? result.data.job : null;
      if (!updated) return;
      setSelectedJob((prev) => (prev && prev.id === updated.id ? updated : prev));
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      if (isTerminal(updated.status)) {
        clearInterval(interval);
        if (updated.status === "needs_review" || updated.status === "succeeded") {
          void loadQuestions(updated.id);
        }
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedJob?.id, selectedJob?.status, workspaceId, loadQuestions]);

  // Keep the active question tab scrolled into view in the horizontal strip.
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeQuestion?.id]);

  const selectJob = (job: DocumentImportJob) => {
    setSelectedJob(job);
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

  // Build the current editor's content+classification payload for a question.
  function buildQuestionFields(questionId: string) {
    const optionsPayload =
      editOptions.length > 0
        ? Object.fromEntries(editOptions.map((text, i) => [String.fromCharCode(97 + i), text]))
        : null;
    return {
      questionId,
      questionText: editStem,
      options: optionsPayload,
      correctOption: editCorrectOption,
      answerText: editAnswer || null,
      subject: editSubject.trim() || "general",
      chapter: editChapter.trim() || "general",
      concept: editConcept.trim() || editChapter.trim() || "general",
      difficulty: editDifficulty,
    };
  }

  // Persist the current editor (content + subject/chapter/topic/difficulty) without approving.
  async function saveQuestionEdits(questionId: string): Promise<boolean> {
    if (!selectedJob) return false;
    const result = await apiJson<{ question: ImportJobQuestion }>(
      `/api/teacher/workspaces/${workspaceId}/import-jobs/${selectedJob.id}?action=update-question`,
      { method: "POST", json: buildQuestionFields(questionId) },
    );
    if (result.ok) {
      setQuestions(prev => prev.map(q => q.id === questionId ? result.data.question : q));
      setActiveQuestion(prev => prev && prev.id === questionId ? result.data.question : prev);
      return true;
    }
    toast.error(result.detail || "Failed to save changes");
    return false;
  }

  function handleSaveQuestion(questionId: string) {
    startTransition(async () => {
      if (await saveQuestionEdits(questionId)) toast.success("Saved.");
    });
  }

  function handleApplySubjectToAll() {
    if (!selectedJob) return;
    const subject = bulkSubject.trim();
    if (!subject) return;
    startTransition(async () => {
      const result = await apiJson<{ updatedCount?: number }>(
        `/api/teacher/workspaces/${workspaceId}/import-jobs/${selectedJob.id}?action=apply-subject`,
        { method: "POST", json: { subject } },
      );
      if (result.ok) {
        toast.success(`Set subject "${subject}" on ${result.data.updatedCount ?? "all"} questions.`);
        setBulkSubject("");
        await loadQuestions(selectedJob.id);
        if (activeQuestionRef.current) setEditSubject(subject);
      } else {
        toast.error(result.detail || "Failed to apply subject");
      }
    });
  }

  // Actions
  async function handleApproveQuestion(questionId: string) {
    if (!selectedJob) return;
    startTransition(async () => {
      // Persist any edits (stem/options/subject/topic/difficulty) first, then accept.
      await saveQuestionEdits(questionId);
      const result = await apiJson(
        `/api/teacher/workspaces/${workspaceId}/import-jobs/${selectedJob.id}?action=review-question`,
        {
          method: "POST",
          json: { action: "accept", questionId },
        }
      );

      if (result.ok) {
        toast.success("Question accepted.");
        setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, status: "accepted" as const } : q));
        setActiveQuestion(prev => prev && prev.id === questionId ? { ...prev, status: "accepted" as const } : prev);
      } else {
        toast.error(result.detail || "Failed to approve question");
      }
    });
  }

  async function handleBulkApprove() {
    if (!selectedJob) return;
    startTransition(async () => {
      // Pending = not yet accepted/published and not rejected (reject curates out).
      const pendingIds = questions
        .filter(q => q.status === "draft" || q.status === "review_required")
        .map(q => q.id);
      if (pendingIds.length === 0) {
        toast.info("All questions are already in the Question Bag.");
        setShowFinishModal(false);
        return;
      }

      const result = await apiJson<{ acceptedCount?: number }>(
        `/api/teacher/workspaces/${workspaceId}/import-jobs/${selectedJob.id}?action=bulk-accept`,
        {
          method: "POST",
          json: { questionIds: pendingIds },
        }
      );

      if (result.ok) {
        const count = result.data?.acceptedCount ?? pendingIds.length;
        toast.success(`Added ${count} question${count === 1 ? "" : "s"} to the Question Bag.`);
        setQuestions(prev => prev.map(q => pendingIds.includes(q.id) ? { ...q, status: "accepted" as const } : q));
        setActiveQuestion(prev => prev && pendingIds.includes(prev.id) ? { ...prev, status: "accepted" as const } : prev);
        setShowFinishModal(false);
        router.refresh();
      } else {
        toast.error(result.detail || "Failed to add questions to the Question Bag.");
      }
    });
  }

  async function handleCreateTest() {
    if (!selectedJob) return;
    startTransition(async () => {
      const result = await apiJson<{ testId?: string; questionCount?: number }>(
        `/api/teacher/workspaces/${workspaceId}/import-jobs/${selectedJob.id}?action=create-test`,
        { method: "POST", json: {} }
      );
      if (!result.ok) {
        toast.error(result.detail || "Failed to create a test from these questions.");
        return;
      }
      if (!result.data?.testId) {
        toast.error("Failed to create a test from these questions.");
        return;
      }
      setShowFinishModal(false);
      toast.success(`Draft test created with ${result.data.questionCount ?? 0} questions — finish the setup.`);
      router.push(`/teacher/workspaces/${workspaceId}/tests/${result.data.testId}/edit`);
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
                  {/* Animated ingestion progress stepper */}
                  {(() => {
                    const status = selectedJob.status;
                    const isFailed = status === "failed" || status === "cancelled";
                    const currentStep = status === "queued" ? 0 : status === "processing" ? 1 : 2;
                    const running = status === "queued" || status === "processing";
                    const steps = ["Queued", "Extracting", "Reviewing"];
                    return (
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] font-semibold">
                        <span className={`uppercase ${isFailed ? "text-destructive" : "text-primary"}`}>
                          {status.replace(/_/g, " ")}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        {steps.map((label, i) => {
                          const done = i < currentStep || (!running && !isFailed);
                          const isActive = running && i === currentStep;
                          return (
                            <span key={label} className="flex items-center gap-1.5">
                              <span
                                className={`flex items-center gap-1 ${
                                  isFailed && i >= currentStep
                                    ? "text-destructive"
                                    : isActive
                                      ? "text-primary"
                                      : done
                                        ? "text-emerald-500"
                                        : "text-muted-foreground"
                                }`}
                              >
                                {isActive ? (
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                ) : done ? (
                                  <Check className="w-2.5 h-2.5" />
                                ) : (
                                  <Clock className="w-2.5 h-2.5 opacity-60" />
                                )}
                                {label}
                              </span>
                              {i < steps.length - 1 && (
                                <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
                              )}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Single-subject paper: stamp the subject on every question at once */}
                <Input
                  value={bulkSubject}
                  onChange={(e) => setBulkSubject(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplySubjectToAll()}
                  placeholder="Subject for all…"
                  className="h-9 w-36 rounded-lg text-xs"
                />
                <Button
                  variant="outline"
                  onClick={handleApplySubjectToAll}
                  disabled={pending || !bulkSubject.trim() || questions.length === 0}
                  className="h-9 rounded-xl text-xs"
                >
                  Apply to all
                </Button>
                <Button
                  onClick={() => setShowFinishModal(true)}
                  disabled={pending || questions.length === 0}
                  className="bg-primary hover:bg-primary/95 text-black font-bold h-9 rounded-xl gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Approve…
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
                <div className="flex border-b shrink-0 bg-muted/5 overflow-x-auto custom-scrollbar whitespace-nowrap">
                  {questions.map((q, idx) => {
                    const isActive = activeQuestion?.id === q.id;
                    const isApproved = q.status === "accepted";
                    return (
                      <button
                        key={q.id}
                        ref={isActive ? activeTabRef : null}
                        onClick={() => selectQuestion(q)}
                        className={`shrink-0 min-w-[108px] px-4 py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 ${
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

                      {/* Editable classification — segregate like OG Code before approving */}
                      <div className="pt-4 border-t space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground">Classification</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground">Subject</span>
                            <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="e.g. Chemistry" className="h-8 rounded-lg text-xs" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground">Chapter</span>
                            <Input value={editChapter} onChange={(e) => setEditChapter(e.target.value)} placeholder="e.g. Chemical Kinetics" className="h-8 rounded-lg text-xs" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground">Topic</span>
                            <Input value={editConcept} onChange={(e) => setEditConcept(e.target.value)} placeholder="e.g. Rate constant" className="h-8 rounded-lg text-xs" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground">Difficulty</span>
                            <select
                              value={editDifficulty}
                              onChange={(e) => setEditDifficulty(e.target.value as "easy" | "medium" | "hard" | "insane")}
                              className="w-full h-8 rounded-lg border bg-background px-2 text-xs"
                            >
                              <option value="easy">easy</option>
                              <option value="medium">medium</option>
                              <option value="hard">hard</option>
                              <option value="insane">insane</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Sticky Footer controls for single */}
                      <div className="pt-4 border-t flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleSaveQuestion(activeQuestion.id)}
                          disabled={pending}
                          className="h-10 rounded-xl gap-1.5"
                        >
                          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          Save
                        </Button>
                        {activeQuestion.status === "accepted" || activeQuestion.status === "published" ? (
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
                            Save &amp; Approve
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

      {/* Approve flow — two options: add to Question Bag, or build a test */}
      <AnimatePresence>
        {showFinishModal && selectedJob && (
          <motion.div
            key="finish-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => !pending && setShowFinishModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border bg-card shadow-2xl p-6 space-y-5"
            >
              <div className="space-y-1">
                <h3 className="font-bold text-lg">Approve reviewed questions</h3>
                <p className="text-xs text-muted-foreground">
                  Rejected questions are skipped. Everything else is added to your Question Bag,
                  structured by subject → topic → difficulty.
                </p>
              </div>

              <div className="grid gap-3">
                <button
                  disabled={pending}
                  onClick={handleBulkApprove}
                  className="text-left rounded-xl border p-4 hover:border-primary/60 hover:bg-primary/[0.03] transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <FolderOpen className="w-4 h-4 text-primary" /> Add all to Question Bag
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Save the accepted questions to your private bank for reuse in any test or DPP.
                  </p>
                </button>

                <button
                  disabled={pending}
                  onClick={handleCreateTest}
                  className="text-left rounded-xl border p-4 hover:border-primary/60 hover:bg-primary/[0.03] transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <FileCheck className="w-4 h-4 text-primary" /> Create a test from these questions
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Saves them to the bag, then opens the test builder pre-filled — set title,
                    batch &amp; schedule to publish.
                  </p>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setShowFinishModal(false)} disabled={pending} className="rounded-xl">
                  Cancel
                </Button>
                {pending && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground px-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Working…
                  </span>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
