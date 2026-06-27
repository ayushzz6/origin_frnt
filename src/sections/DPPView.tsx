'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { apiCall } from '@/lib/api';
import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import { DegradedBanner } from '@/components/DegradedBanner';
import type { User } from '@/types';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Lightbulb,
  Loader2,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';

const DPP_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

interface DPPViewProps {
  onBack: () => void;
  user: User;
  initialDpps: GeneratedDpp[] | null;
}

interface GeneratedDppAttemptSummary {
  id: string;
  summary: string;
  recommendations: string[];
  resolvedTopics: string[];
  resolved_topics?: string[];
  stillWeakTopics: string[];
  still_weak_topics?: string[];
  progressScore: number;
  progress_score?: number;
  completed: boolean;
  analysisStatus?: 'pending' | 'complete' | 'failed';
  analysis_status?: 'pending' | 'complete' | 'failed';
  analysisError?: string | null;
  analysis_error?: string | null;
  createdAt: string;
}

interface GeneratedDpp {
  id: string;
  title: string;
  subject: string;
  summary?: string;
  weakTopics?: string[];
  weak_topics?: string[];
  generatedFrom?: string[];
  generated_from?: string[];
  createdAt?: string;
  completed: boolean;
  duration?: number;
  targetQuestionCount?: number;
  questions: DppQuestion[];
  latestAttempt?: GeneratedDppAttemptSummary | null;
}

type DppQuestion = {
  id: string;
  text: string;
  options?: string[];
  explanation?: string;
  concept: string;
  difficulty: string;
  subject: string;
  chapter?: string;
  presentationId?: string;
  presentation_id?: string;
  correctOption?: number | null;
  correct_option?: number | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

interface DppSubmissionResponse extends GeneratedDppAttemptSummary {
  degraded?: boolean;
  degradedReason?: string;
  degraded_reason?: string;
  answers: Array<{
    questionId: string;
    selectedOption: number | null;
    selectedOptions?: number[] | null;
    matrixPairs?: number[][] | null;
    answerText?: string | null;
    timeSpent: number;
    isMarkedForReview: boolean;
  }>;
}

type DppCheckResult = {
  isCorrect: boolean;
  is_correct?: boolean;
  correctOption?: number | null;
  correct_option?: number | null;
  explanation?: string;
};

export default function DPPView({ onBack, initialDpps }: DPPViewProps) {
  const [loading, setLoading] = useState(initialDpps === null);
  const [dpps, setDpps] = useState<GeneratedDpp[]>(initialDpps ?? []);
  const [selectedDppId, setSelectedDppId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [revealedAnswers, setRevealedAnswers] = useState<boolean[]>([]);
  const [checkResults, setCheckResults] = useState<(DppCheckResult | null)[]>([]);
  const [timeSpentByQuestion, setTimeSpentByQuestion] = useState<number[]>([]);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<DppSubmissionResponse | null>(null);
  const [error, setError] = useState('');
  const questionStartedAtRef = useRef<number>(Date.now());

  const currentDpp = useMemo(
    () => dpps.find((entry) => entry.id === selectedDppId) ?? null,
    [dpps, selectedDppId],
  );
  const currentQuestions = currentDpp?.questions ?? [];
  const currentQuestion = currentQuestions[currentQuestionIndex] ?? null;
  const progress = currentQuestions.length > 0 ? ((currentQuestionIndex + 1) / currentQuestions.length) * 100 : 0;
  const isCompleted = Boolean(submissionResult);
  const submissionAnalysisStatus = submissionResult?.analysisStatus ?? submissionResult?.analysis_status ?? 'complete';

  useEffect(() => {
    if (initialDpps !== null) {
      return;
    }

    const loadDpps = async () => {
      try {
        setLoading(true);
        setError('');
        const plans = await apiCall('/assessments/dpps/');
        setDpps(Array.isArray(plans) ? plans : []);
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Failed to load generated DPPs.'));
      } finally {
        setLoading(false);
      }
    };
    loadDpps();
  }, [initialDpps]);

  useEffect(() => {
    if (!selectedDppId) {
      return;
    }

    const selectedDpp = dpps.find((entry) => entry.id === selectedDppId);
    if (selectedDpp?.questions?.length) {
      return;
    }

    const loadDetail = async () => {
      try {
        setLoading(true);
        const detail = await apiCall(`/assessments/dpps/${selectedDppId}/`);
        setDpps((previous) => previous.map((entry) => (entry.id === selectedDppId ? detail : entry)));
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Failed to load DPP details.'));
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [dpps, selectedDppId]);

  useEffect(() => {
    const questionCount = currentDpp?.questions?.length ?? 0;
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setShowSolution(false);
    setAnswers(new Array(questionCount).fill(null));
    setRevealedAnswers(new Array(questionCount).fill(false));
    setCheckResults(new Array(questionCount).fill(null));
    setTimeSpentByQuestion(new Array(questionCount).fill(0));
    setSubmissionResult(null);
    questionStartedAtRef.current = Date.now();
  }, [selectedDppId, currentDpp?.questions?.length]);

  useEffect(() => {
    if (!selectedDppId || submissionAnalysisStatus !== 'pending') {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const detail = await apiCall(`/assessments/dpps/${selectedDppId}/`);
        if (cancelled) {
          return;
        }
        setDpps((previous) => previous.map((entry) => (entry.id === selectedDppId ? detail : entry)));
        if (detail?.latestAttempt) {
          setSubmissionResult((previous) => ({
            ...detail.latestAttempt,
            answers: previous?.answers ?? [],
          }));
        }
      } catch {
        // Keep the scored pending attempt visible until a later poll succeeds.
      }
    };

    const interval = window.setInterval(poll, 3000);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedDppId, submissionAnalysisStatus]);

  const getCorrectOption = (index: number) => {
    const result = checkResults[index];
    return result?.correctOption ?? result?.correct_option ?? null;
  };

  const getElapsedSeconds = () => Math.max(0, Math.round((Date.now() - questionStartedAtRef.current) / 1000));

  const recordCurrentQuestionTime = () => {
    const elapsedSeconds = getElapsedSeconds();
    if (elapsedSeconds <= 0) {
      questionStartedAtRef.current = Date.now();
      return;
    }

    setTimeSpentByQuestion((previous) => {
      const next = [...previous];
      next[currentQuestionIndex] = (next[currentQuestionIndex] ?? 0) + elapsedSeconds;
      return next;
    });
    questionStartedAtRef.current = Date.now();
  };

  const goToQuestion = (nextIndex: number) => {
    recordCurrentQuestionTime();
    setCurrentQuestionIndex(nextIndex);
    setSelectedOption(answers[nextIndex] ?? null);
    setShowSolution(revealedAnswers[nextIndex] ?? false);
    questionStartedAtRef.current = Date.now();
  };

  const handleOptionSelect = (optionIndex: number) => {
    if (showSolution || !currentQuestion) return;
    setSelectedOption(optionIndex);
  };

  const handleCheck = async () => {
    if (selectedOption === null || !currentQuestion || !currentDpp) return;
    const elapsedSeconds = getElapsedSeconds();
    recordCurrentQuestionTime();
    setChecking(true);
    setError('');
    try {
      const response = await apiCall(`/assessments/dpps/${currentDpp?.id}/check/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          presentation_id: currentQuestion.presentationId ?? currentQuestion.presentation_id ?? null,
          selected_option: selectedOption,
          time_spent: (timeSpentByQuestion[currentQuestionIndex] ?? 0) + elapsedSeconds,
        }),
      });
      setShowSolution(true);
      setAnswers((previous) => {
        const next = [...previous];
        next[currentQuestionIndex] = selectedOption;
        return next;
      });
      setRevealedAnswers((previous) => {
        const next = [...previous];
        next[currentQuestionIndex] = true;
        return next;
      });
      setCheckResults((previous) => {
        const next = [...previous];
        next[currentQuestionIndex] = response;
        return next;
      });
    } catch (checkError) {
      setError(getErrorMessage(checkError, 'Failed to check answer.'));
    } finally {
      setChecking(false);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex <= 0) return;
    goToQuestion(currentQuestionIndex - 1);
  };

  const submitCurrentDpp = async () => {
    if (!currentDpp) return;
    recordCurrentQuestionTime();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        answers: currentQuestions.map((question, index) => ({
          question_id: question.id,
          presentation_id: question.presentationId ?? question.presentation_id ?? null,
          selected_option: answers[index],
          time_spent: timeSpentByQuestion[index] ?? 0,
          is_marked_for_review: false,
        })),
        time_taken: timeSpentByQuestion.reduce((sum, seconds) => sum + seconds, 0),
      };
      const response = await apiCall(`/assessments/dpps/${currentDpp.id}/submit/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSubmissionResult(response);
      setDpps((previous) =>
        previous.map((entry) =>
          entry.id === currentDpp.id
            ? {
                ...entry,
                completed: response.completed,
                latestAttempt: response,
              }
            : entry,
        ),
      );
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Failed to submit DPP.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
      goToQuestion(currentQuestionIndex + 1);
      return;
    }
    await submitCurrentDpp();
  };

  const retryCurrentDpp = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setShowSolution(false);
    setAnswers(new Array(currentQuestions.length).fill(null));
    setRevealedAnswers(new Array(currentQuestions.length).fill(false));
    setCheckResults(new Array(currentQuestions.length).fill(null));
    setTimeSpentByQuestion(new Array(currentQuestions.length).fill(0));
    setSubmissionResult(null);
    questionStartedAtRef.current = Date.now();
  };

  const correctCount = checkResults.filter((result) => Boolean(result?.isCorrect ?? result?.is_correct)).length;

  return (
    <div id="tutorial-dpp-hub" className="min-h-screen neu-surface text-foreground transition-colors duration-300">
      <header className="z-40 bg-[hsl(var(--neu-bg)/0.9)] border-b border-border/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4 truncate">
              <button
                onClick={() => (selectedDppId ? setSelectedDppId(null) : onBack())}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label={selectedDppId ? 'Back to DPP list' : 'Back to dashboard'}
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="truncate">
                <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white truncate">Daily Practice Problems</h1>
                <p className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 truncate">
                  {selectedDppId
                    ? 'Solve a DPP, then jump back to pick another'
                    : 'Pick any generated DPP — one per recent test'}
                </p>
              </div>
            </div>
            <Badge className="bg-primary/10 text-primary dark:bg-primary/20 hidden xs:flex">
              <Sparkles className="w-3 h-3 mr-1" />
              Service Generated
            </Badge>
          </div>
        </div>
        <Progress value={progress} className="h-1 rounded-none" />
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {loading ? (
          <Card className="neu-raised border-0 shadow-none">
            <CardContent className="p-8 flex items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading DPPs...
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="neu-raised border-0 shadow-none">
            <CardContent className="p-8 text-center text-red-500">{error}</CardContent>
          </Card>
        ) : dpps.length === 0 ? (
          <Card className="neu-raised border-0 shadow-none">
            <CardContent className="p-8 text-center space-y-3">
              <Target className="w-10 h-10 text-primary mx-auto" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">No DPPs generated yet</h2>
              <p className="text-slate-500 dark:text-slate-400">
                Submit a custom or regular test first so the analytics pipeline can generate targeted DPPs.
              </p>
            </CardContent>
          </Card>
        ) : !selectedDppId ? (
          <DppSelectionGrid dpps={dpps} onSelect={setSelectedDppId} />
        ) : !currentDpp ? (
          <Card className="neu-raised border-0 shadow-none">
            <CardContent className="p-8 flex items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading DPP...
            </CardContent>
          </Card>
        ) : isCompleted ? (
          <Card className="neu-raised border-0 shadow-none">
            <CardContent className="p-8 text-center">
              {submissionAnalysisStatus === 'pending' ? (
                <div className="mb-6 text-left">
                  <DegradedBanner
                    title="Analytics processing"
                    reason="Your DPP score is ready. Detailed progress analysis will update shortly."
                  />
                </div>
              ) : submissionResult?.degraded ? (
                <div className="mb-6 text-left">
                  <DegradedBanner reason={submissionResult.degradedReason ?? submissionResult.degraded_reason ?? null} />
                </div>
              ) : null}
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-[#1E3A5F] flex items-center justify-center mb-6">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">DPP Completed</h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-6">
                {submissionResult?.summary ?? 'Your DPP attempt has been analyzed.'}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-md mx-auto mb-8">
                <div className="p-3 sm:p-4 rounded-xl bg-primary/5 dark:bg-primary/10">
                  <div className="text-xl sm:text-3xl font-bold text-primary">{correctCount}</div>
                  <div className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Correct</div>
                </div>
                <div className="p-3 sm:p-4 rounded-xl bg-red-50 dark:bg-red-900/20">
                  <div className="text-xl sm:text-3xl font-bold text-red-600">{currentQuestions.length - correctCount}</div>
                  <div className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Wrong</div>
                </div>
                <div className="p-3 sm:p-4 rounded-xl bg-primary/10 dark:bg-primary/20">
                  <div className="text-xl sm:text-3xl font-bold text-primary">
                    {Math.round(submissionResult?.progress_score ?? submissionResult?.progressScore ?? 0)}%
                  </div>
                  <div className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Score</div>
                </div>
              </div>

              <div className="space-y-4 max-w-2xl mx-auto text-left">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Recommendations</h3>
                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {(submissionResult?.recommendations ?? []).map((item, index) => (
                      <li key={`${item}-${index}`}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-4 mt-8">
                <Button variant="outline" onClick={retryCurrentDpp} className="rounded-full">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retry DPP
                </Button>
                {dpps.length > 1 ? (
                  <Button
                    variant="outline"
                    onClick={() => setSelectedDppId(null)}
                    className="rounded-full"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Pick another DPP
                  </Button>
                ) : null}
                <Button onClick={onBack} className="rounded-full bg-gradient-to-r from-primary to-[#1E3A5F] text-white">
                  Back to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="neu-raised border-0 shadow-none">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Badge className="bg-primary/10 text-primary">
                      Q{currentQuestionIndex + 1} of {currentQuestions.length}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {currentQuestion?.difficulty}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {currentQuestion?.subject}
                    </Badge>
                  </div>

                  {currentQuestion ? (
                    <>
                      <div className="text-lg sm:text-xl font-medium text-slate-900 dark:text-white mb-6 leading-relaxed">
                        <FormattedMessage content={currentQuestion.text} />
                      </div>

                      <div className="space-y-3 mb-6">
                        {(currentQuestion.options ?? []).map((option, index) => (
                          <button
                            key={`${currentQuestion.id}-${index}`}
                            onClick={() => handleOptionSelect(index)}
                            disabled={showSolution}
                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                              showSolution
                                ? index === getCorrectOption(currentQuestionIndex)
                                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                  : selectedOption === index
                                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                    : 'border-slate-200 dark:border-slate-700 opacity-50'
                                : selectedOption === index
                                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                                  showSolution
                                    ? index === getCorrectOption(currentQuestionIndex)
                                      ? 'bg-primary text-white'
                                      : selectedOption === index
                                        ? 'bg-red-500 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    : selectedOption === index
                                      ? 'bg-primary text-white'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {showSolution && index === getCorrectOption(currentQuestionIndex) ? (
                                  <CheckCircle2 className="w-5 h-5" />
                                ) : showSolution && selectedOption === index ? (
                                  <XCircle className="w-5 h-5" />
                                ) : (
                                  String.fromCharCode(65 + index)
                                )}
                              </div>
                              <span
                                className={`text-base sm:text-lg ${
                                  showSolution && index === getCorrectOption(currentQuestionIndex)
                                    ? 'text-primary'
                                    : showSolution && selectedOption === index
                                      ? 'text-red-700 dark:text-red-400'
                                      : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <FormattedMessage content={String(option)} inline />
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {showSolution && (
                        <div className="mb-6 p-6 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-primary" />
                            Explanation
                          </h4>
                          <div className="text-slate-700 dark:text-slate-300 leading-relaxed">
                            <FormattedMessage content={checkResults[currentQuestionIndex]?.explanation ?? currentQuestion.explanation ?? ''} />
                          </div>
                          <div className="mt-4 pt-4 border-t border-primary/20">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              <strong className="text-slate-900 dark:text-white">Concept:</strong> {currentQuestion.concept}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0} className="rounded-full">
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Previous
                        </Button>

                        {!showSolution ? (
                          <Button
                            onClick={handleCheck}
                            disabled={selectedOption === null || checking}
                            className="rounded-full bg-gradient-to-r from-primary to-[#1E3A5F] text-white"
                          >
                            {checking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            {checking ? 'Checking...' : 'Check Answer'}
                          </Button>
                        ) : (
                          <Button
                            onClick={handleNext}
                            disabled={submitting}
                            className="rounded-full bg-gradient-to-r from-primary to-[#1E3A5F] text-white"
                          >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {currentQuestionIndex === currentQuestions.length - 1 ? 'Finish' : 'Next'}
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="neu-raised border-0 shadow-none">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{currentDpp.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {currentDpp.summary ?? 'Targeted practice generated from your latest weak-topic analytics.'}
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {currentQuestions.map((question, index) => (
                      <button
                        key={question.id}
                        onClick={() => goToQuestion(index)}
                        className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${
                          index === currentQuestionIndex ? 'ring-2 ring-primary ring-offset-2' : ''
                        } ${
                          answers[index] !== null
                            ? Boolean(checkResults[index]?.isCorrect ?? checkResults[index]?.is_correct)
                              ? 'bg-primary text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-soft bg-gradient-to-br from-primary to-[#1E3A5F] text-white dark:ring-1 dark:ring-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <MessageCircle className="w-5 h-5" />
                    <h3 className="font-semibold">AI Mentor</h3>
                  </div>
                  <p className="text-white/80 text-sm">
                    Origin AI will pick up these weak topics automatically once you submit this DPP.
                  </p>
                </CardContent>
              </Card>

              <Card className="neu-raised border-0 shadow-none">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Focus Areas
                  </h3>
                  <div className="space-y-2">
                    {(currentDpp.weakTopics ?? currentDpp.weak_topics ?? []).map((topic) => (
                      <Badge
                        key={topic}
                        variant="secondary"
                        className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 mr-2"
                      >
                        {topic}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                    These questions were generated to repair the weakest concepts from your recent test analytics.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DppSelectionGrid({
  dpps,
  onSelect,
}: {
  dpps: GeneratedDpp[];
  onSelect: (dppId: string) => void;
}) {
  const formatDate = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return DPP_DATE_FORMATTER.format(parsed);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {dpps.length} DPP{dpps.length === 1 ? '' : 's'} ready for you
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Each card comes from a test you submitted. Pick one to start solving.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {dpps.map((dpp) => {
          const questionCount = dpp.questions?.length ?? dpp.targetQuestionCount ?? 0;
          const weakTopics = dpp.weakTopics ?? dpp.weak_topics ?? [];
          const generatedDate = formatDate(dpp.createdAt);
          const progressScore = dpp.latestAttempt?.progress_score ?? dpp.latestAttempt?.progressScore ?? null;

          return (
            <Card
              key={dpp.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(dpp.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(dpp.id);
                }
              }}
              className="h-full cursor-pointer neu-raised neu-pressable border-0 shadow-none"
            >
              <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="capitalize">
                          {dpp.subject}
                        </Badge>
                        {dpp.completed ? (
                          <Badge className="bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        ) : (
                          <Badge className="bg-primary/10 text-primary">
                            <Sparkles className="w-3 h-3 mr-1" />
                            New
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white leading-snug">
                        {dpp.title}
                      </h3>
                      {dpp.summary ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                          {dpp.summary}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {weakTopics.slice(0, 3).map((topic) => (
                      <Badge
                        key={topic}
                        variant="secondary"
                        className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                      >
                        {topic}
                      </Badge>
                    ))}
                    {weakTopics.length > 3 ? (
                      <span className="text-xs text-slate-400 self-center">+{weakTopics.length - 3} more</span>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-4">
                      <span className="inline-flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {questionCount} Qs
                      </span>
                      {dpp.duration ? (
                        <span>{dpp.duration} min</span>
                      ) : null}
                      {generatedDate ? <span>Generated {generatedDate}</span> : null}
                    </div>
                    {progressScore !== null ? (
                      <span className="text-primary font-semibold">{Math.round(progressScore)}%</span>
                    ) : null}
                  </div>

                  <div className="pt-2">
                    <Button asChild className="w-full rounded-full bg-gradient-to-r from-primary to-[#1E3A5F] text-white">
                      <span>
                      {dpp.completed ? 'Review DPP' : 'Start Solving'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                      </span>
                    </Button>
                  </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
