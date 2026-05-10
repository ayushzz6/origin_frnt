'use client';
import { useState, useEffect, useRef } from 'react';
import { Camera, AlertTriangle, ShieldCheck, CheckCircle2, Loader2, Play, Info, X } from 'lucide-react';
import type { Test, TestResult, UserAnswer } from '@/types';
import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import { submitTestAction } from '@/server/actions/test-actions';
import type { TestSubmissionPayload } from '@/server/assessments';
import { useServerAnchoredTimer, type ServerAnchoredTimerSource } from '@/hooks/useServerAnchoredTimer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { shouldSubmitTestAnswer } from '@/lib/tests/time-stats';

const renderQuestionText = (text: string, idPrefix: string) => {
    return <FormattedMessage content={text} isAssistant={true} className="text-slate-900 !prose-slate" />;
};

const renderInlineSegments = (text: string, idPrefix: string, type: 'plain' | 'math') => {
    return <FormattedMessage content={text} inline={true} isAssistant={true} className="text-slate-900" />;
};

interface TestInterfaceProps {
  test: Test;
  onComplete: (result: TestResult) => void | Promise<void>;
  onExit: () => void;
  timerSource?: ServerAnchoredTimerSource;
  submitHandler?: (payload: TestSubmissionPayload) => Promise<unknown>;
}

// NTA Status Types
type QuestionStatus = 'not_visited' | 'not_answered' | 'answered' | 'marked_review' | 'answered_marked';

export default function TestInterface({ test, onComplete, onExit, timerSource, submitHandler }: TestInterfaceProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const durationSeconds = timerSource?.durationSeconds ?? test.duration * 60;
  const [timeRemaining, setTimeRemaining] = useState(durationSeconds);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [proctorStatus, setProctorStatus] = useState<'monitoring' | 'warning' | 'error'>('monitoring');
  const [mobileDetected, setMobileDetected] = useState(false);
  const [violations, setViolations] = useState(0);
  const [showMalpracticeWarning, setShowMalpracticeWarning] = useState(false);
  const [isMalpracticeTerminated, setIsMalpracticeTerminated] = useState(false);
  const malpracticeTimerRef = useRef<any>(null);
  const [isExamStarted, setIsExamStarted] = useState(false);
  const serverTimeRemaining = useServerAnchoredTimer(timerSource, isExamStarted);
  const effectiveTimeRemaining = timerSource ? serverTimeRemaining : timeRemaining;
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [verificationStep, setVerificationStep] = useState<'instructions' | 'proctoring'>('instructions');
  const [hasAcceptedRules, setHasAcceptedRules] = useState(false);
  const [showRefreshWarning, setShowRefreshWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const allowSubmittedNavigationRef = useRef(false);
  const questionStartedAtRef = useRef<number>(Date.now());

  // Proctoring setup - gated by verification step
  useEffect(() => {
    if (verificationStep !== 'proctoring') return;

    async function startProctoring() {
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, frameRate: 15 }
        });
        streamRef.current = stream;
        
        // Attach to both potential video elements
        if (videoRef.current) videoRef.current.srcObject = stream;
        if (previewVideoRef.current) previewVideoRef.current.srcObject = stream;
        
        setIsCameraActive(true);
        
        // Simulate face detection for 1.5 seconds
        setTimeout(() => {
          setIsFaceDetected(true);
        }, 1500);

      } catch (err: any) {
        console.error("Camera access failed", err);
        setProctorStatus('error');
        setIsCameraActive(false);
        setCameraError(err.message || "Could not access camera");
      }
    }

    startProctoring();

    // Secondary sync: if refs attach late, try to set srcObject again
    const syncInterval = setInterval(() => {
      if (streamRef.current) {
        if (videoRef.current && !videoRef.current.srcObject) videoRef.current.srcObject = streamRef.current;
        if (previewVideoRef.current && !previewVideoRef.current.srcObject) previewVideoRef.current.srcObject = streamRef.current;
      }
    }, 500);

    return () => {
      clearInterval(syncInterval);
      stopCamera();
      if (malpracticeTimerRef.current) clearTimeout(malpracticeTimerRef.current);
    };
  }, [verificationStep]);

  // Mock detection logic - only when exam started
  useEffect(() => {
    if (!isExamStarted) return;

    const detectionInterval = setInterval(() => {
      // Small chance of simulation every interval
      if (Math.random() < 0.15) { // Increased probability for testing
        setMobileDetected(true);
        setProctorStatus('warning');
        
        // Actually trigger a violation in the simulation
        setViolations(prev => {
          const next = prev + 1;
          if (next >= 3) {
            terminateWithMalpractice();
          } else {
            setShowMalpracticeWarning(true);
          }
          return next;
        });

        // Auto-clear after 5 seconds
        setTimeout(() => {
          setMobileDetected(false);
          setProctorStatus('monitoring');
        }, 5000);
      }
    }, 15000); // More frequent check for demo purposes

    return () => clearInterval(detectionInterval);
  }, [isExamStarted]);

  // Malpractice Detection Logic
  useEffect(() => {
    if (!isExamStarted) return;
    
    const handleViolation = () => {
      setViolations(prev => {
        const next = prev + 1;
        if (next >= 3) {
          terminateWithMalpractice();
        } else {
          setShowMalpracticeWarning(true);
        }
        return next;
      });
    };

    const startTimer = () => {
      if (!malpracticeTimerRef.current && !isMalpracticeTerminated) {
        // Very strict: 1 second grace period for accidental focus loss
        malpracticeTimerRef.current = setTimeout(() => {
          handleViolation();
          malpracticeTimerRef.current = null;
        }, 1000);
      }
    };

    const stopTimer = () => {
      if (malpracticeTimerRef.current) {
        clearTimeout(malpracticeTimerRef.current);
        malpracticeTimerRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) startTimer();
      else stopTimer();
    };

    const handleBlur = () => startTimer();
    const handleFocus = () => stopTimer();

    // Prevent Inspect Element and Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Cmd+Option+I
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u') ||
        (e.metaKey && e.altKey && (e.key === 'i' || e.key === 'j')) ||
        (e.ctrlKey && e.key === 's') || // Prevent Save
        (e.metaKey && e.key === 's')
      ) {
        e.preventDefault();
        toast.error("Shortcut blocked during examination");
      }

      // Block Refresh (F5, Ctrl+R, Cmd+R)
      if (
        e.key === 'F5' ||
        (e.ctrlKey && (e.key === 'r' || e.key === 'R')) ||
        (e.metaKey && (e.key === 'r' || e.key === 'R'))
      ) {
        e.preventDefault();
        setShowRefreshWarning(true);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExamStarted && !allowSubmittedNavigationRef.current) {
        e.preventDefault();
        e.returnValue = "Refreshing the page will automatically SUBMIT your exam. Are you sure?";
        return e.returnValue;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast.error("Right-click disabled during examination");
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isExamStarted, isMalpracticeTerminated]);

  const terminateWithMalpractice = () => {
    setIsMalpracticeTerminated(true);
    stopCamera();
    // Start submission immediately
    finalSubmit({ malpractice: true });
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Initialize tracking
  useEffect(() => {
    const initialAnswers = test.questions.map((q) => ({
      questionId: q.id,
      presentationId: q.presentationId ?? q.presentation_id ?? null,
      selectedOption: null,
      selectedOptions: [],
      matrixPairs: [],
      answerText: '',
      timeSpent: 0,
      isMarkedForReview: false,
    }));
    setAnswers(initialAnswers);

    // Visit first question
    setVisitedStats(prev => {
      const next = [...prev];
      next[0] = true;
      return next;
    });
    questionStartedAtRef.current = Date.now();
  }, [test.questions]);

  // Track if a question has been visited at all
  const [visitedStats, setVisitedStats] = useState<boolean[]>(new Array(test.questions.length).fill(false));

  const markVisited = (index: number) => {
    setVisitedStats(prev => {
      if (prev[index]) return prev;
      const next = [...prev];
      next[index] = true;
      return next;
    });
  };

  useEffect(() => {
    if (!timerSource || !isExamStarted) return;
    if (serverTimeRemaining <= 0) {
      finalSubmit();
    }
  }, [isExamStarted, serverTimeRemaining, timerSource]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (timerSource) return;
    if (!isExamStarted) return;
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          finalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isExamStarted, timerSource]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getQuestionStatus = (index: number): QuestionStatus => {
    if (!answers[index] || !visitedStats[index]) return 'not_visited';
    const ans = answers[index];

    const hasAnswered = 
        ans.selectedOption !== null || 
        (ans.selectedOptions && ans.selectedOptions.length > 0) || 
        (ans.matrixPairs && ans.matrixPairs.length > 0) || 
        (ans.answerText && ans.answerText.trim() !== '');

    if (hasAnswered && ans.isMarkedForReview) return 'answered_marked';
    if (hasAnswered && !ans.isMarkedForReview) return 'answered';
    if (!hasAnswered && ans.isMarkedForReview) return 'marked_review';
    return 'not_answered';
  };

  // Group questions by subject for NTA-style sections
  const subjects = Array.from(new Set(test.questions.map((q) => q.subject))).filter(Boolean);
  const activeSubject = test.questions[currentQuestionIndex]?.subject;

  const getSubjectStats = (subjectName: string) => {
    let not_answered = 0;
    let answered = 0;
    let marked_review = 0;
    let answered_marked = 0;

    test.questions.forEach((q, i) => {
      if (q.subject === subjectName) {
        const status = getQuestionStatus(i);
        if (status === 'not_answered') not_answered++;
        else if (status === 'answered') answered++;
        else if (status === 'marked_review') marked_review++;
        else if (status === 'answered_marked') answered_marked++;
      }
    });

    return { not_answered, answered, marked_review, answered_marked };
  };

  const currentQuestion = test.questions[currentQuestionIndex];

  // Temp state for selection before saving
  const [tempSelection, setTempSelection] = useState<number | null>(null);
  const [tempSelections, setTempSelections] = useState<number[]>([]);
  const [tempMatrixPairs, setTempMatrixPairs] = useState<number[][]>([]);
  const [tempTextAnswer, setTempTextAnswer] = useState<string>('');

  // Sync temp selection when navigating
  useEffect(() => {
    if (answers[currentQuestionIndex]) {
      setTempSelection(answers[currentQuestionIndex].selectedOption ?? null);
      setTempSelections(answers[currentQuestionIndex].selectedOptions || []);
      setTempMatrixPairs(answers[currentQuestionIndex].matrixPairs || []);
      setTempTextAnswer(answers[currentQuestionIndex].answerText || '');
    } else {
      setTempSelection(null);
      setTempSelections([]);
      setTempMatrixPairs([]);
      setTempTextAnswer('');
    }
    markVisited(currentQuestionIndex);
    questionStartedAtRef.current = Date.now();
  }, [currentQuestionIndex, answers]);

  const getElapsedSeconds = () => Math.max(0, Math.round((Date.now() - questionStartedAtRef.current) / 1000));

  const recordCurrentQuestionTime = () => {
    const elapsedSeconds = getElapsedSeconds();
    if (elapsedSeconds <= 0 || !answers[currentQuestionIndex]) {
      questionStartedAtRef.current = Date.now();
      return answers;
    }

    const updatedAnswers = [...answers];
    updatedAnswers[currentQuestionIndex] = {
      ...updatedAnswers[currentQuestionIndex],
      timeSpent: (updatedAnswers[currentQuestionIndex].timeSpent ?? 0) + elapsedSeconds,
    };
    questionStartedAtRef.current = Date.now();
    setAnswers(updatedAnswers);
    return updatedAnswers;
  };

  const saveCurrentResponse = (isMarkedForReview: boolean) => {
    const elapsedSeconds = getElapsedSeconds();
    const updatedAnswers = [...answers];
    const currentAnswer = updatedAnswers[currentQuestionIndex];
    const currentQuestionId = test.questions[currentQuestionIndex]?.id;
    updatedAnswers[currentQuestionIndex] = {
      ...currentAnswer,
      questionId: currentAnswer?.questionId ?? currentQuestionId,
      presentationId:
        currentAnswer?.presentationId ??
        test.questions[currentQuestionIndex]?.presentationId ??
        test.questions[currentQuestionIndex]?.presentation_id ??
        null,
      selectedOption: tempSelection,
      selectedOptions: tempSelections,
      matrixPairs: tempMatrixPairs,
      answerText: tempTextAnswer,
      isMarkedForReview,
      timeSpent: (updatedAnswers[currentQuestionIndex]?.timeSpent ?? 0) + elapsedSeconds,
    };
    questionStartedAtRef.current = Date.now();
    setAnswers(updatedAnswers);
    return updatedAnswers;
  };

  const moveToQuestion = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= test.questions.length) return;
    setCurrentQuestionIndex(nextIndex);
  };

  const navigateToQuestion = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= test.questions.length) return;
    saveCurrentResponse(answers[currentQuestionIndex]?.isMarkedForReview ?? false);
    moveToQuestion(nextIndex);
  };

  const handleOptionSelect = (optionIndex: number) => {
    setTempSelection(optionIndex);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setTempTextAnswer(e.target.value);
  };

  const handleClearResponse = () => {
    setTempSelection(null);
    setTempSelections([]);
    setTempMatrixPairs([]);
    setTempTextAnswer('');
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = {
      ...newAnswers[currentQuestionIndex],
      selectedOption: null,
      selectedOptions: [],
      matrixPairs: [],
      answerText: '',
      isMarkedForReview: false // also clears review status usually in NTA
    };
    setAnswers(newAnswers);
  };

  const saveAndNext = () => {
    saveCurrentResponse(false);
    if (currentQuestionIndex < test.questions.length - 1) {
      moveToQuestion(currentQuestionIndex + 1);
    }
  };

  const saveAndMarkForReview = () => {
    saveCurrentResponse(true);
    if (currentQuestionIndex < test.questions.length - 1) {
      moveToQuestion(currentQuestionIndex + 1);
    }
  };

  const markForReviewAndNext = () => {
    saveCurrentResponse(true);
    if (currentQuestionIndex < test.questions.length - 1) {
      moveToQuestion(currentQuestionIndex + 1);
    }
  };

  const finalSubmit = async (options?: { malpractice?: boolean }) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const submissionToastId = toast.loading('Submitting your test... Please wait while we process your AI analytics.');
    stopCamera();
    setShowSubmitModal(false);

    try {
      const isMalpractice = options?.malpractice || false;
      const answersWithCurrentResponse = saveCurrentResponse(answers[currentQuestionIndex]?.isMarkedForReview ?? false);
      const formattedAnswers = answersWithCurrentResponse.filter((a) => a.questionId && shouldSubmitTestAnswer(a)).map(a => ({
        questionId: a.questionId,
        presentationId: a.presentationId ?? null,
        selectedOption: a.selectedOption,
        selectedOptions: a.selectedOptions,
        matrixPairs: a.matrixPairs,
        answerText: a.answerText,
        timeSpent: a.timeSpent,
        isMarkedForReview: a.isMarkedForReview
      }));

      const payload = {
        answers: formattedAnswers,
        timeTaken: Math.max(0, durationSeconds - effectiveTimeRemaining),
        isMalpractice: isMalpractice
      };

      const result = submitHandler
        ? await submitHandler(payload)
        : await submitTestAction(test.id, payload);

      allowSubmittedNavigationRef.current = true;
      toast.dismiss(submissionToastId);
      await Promise.resolve(onComplete(result as TestResult));
    } catch (error: any) {
      allowSubmittedNavigationRef.current = false;
      toast.dismiss(submissionToastId);
      console.error('Test submission failed:', error);
      toast.error('Failed to submit test. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Stats for Legend
  const stats = {
    not_visited: 0,
    not_answered: 0,
    answered: 0,
    marked: 0,
    answered_marked: 0
  };

  answers.forEach((_, i) => {
    const status = getQuestionStatus(i);
    if (status === 'not_visited') stats.not_visited++;
    else if (status === 'not_answered') stats.not_answered++;
    else if (status === 'answered') stats.answered++;
    else if (status === 'marked_review') stats.marked++;
    else if (status === 'answered_marked') stats.answered_marked++;
  });

  return (
    <div className="min-h-screen bg-white text-black font-sans text-sm selection:bg-blue-200 flex flex-col relative">

      {/* 0. Verification Overlay */}
      {!isExamStarted && (
        <div className="fixed inset-0 z-[200] bg-slate-900 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
          {verificationStep === 'instructions' ? (
            /* Phase 1: Instructions */
            <div className="max-w-5xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-rose-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-1.5 shadow-md">
                    <img src="/origin-logo.png" alt="O3" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.src = 'https://api.dicebear.com/7.x/initials/svg?seed=O3'; }} />
                  </div>
                  <h2 className="text-white font-black text-lg uppercase tracking-tight">General Instructions</h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-white/70 text-xs font-bold uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full">
                    Time: {test.duration} Minutes
                  </div>
                  <button onClick={onExit} className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 text-gray-700">
                
                <section>
                  <h3 className="text-rose-900 font-bold text-lg mb-4 border-b-2 border-rose-100 pb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-rose-100 text-rose-900 rounded-full flex items-center justify-center text-xs">1</span>
                    Standard Exam Rules
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <ul className="space-y-3 list-disc pl-5 font-medium">
                      <li>The total duration of the examination is <span className="font-bold text-primary">{test.duration} minutes</span>.</li>
                      <li>The clock will be set at the server. The countdown timer at the top right corner of the screen will display the remaining time available for you to complete the examination.</li>
                      <li>The Question Palette displayed on the right side of the screen will show the status of each question using one of the following symbols:</li>
                    </ul>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                       <div className="flex items-center gap-3">
                        <div className="w-6 h-5 bg-white border border-gray-400 rounded-sm"></div>
                        <span className="text-xs font-bold">You have not visited the question yet.</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-tr-[10px] rounded-br-[2px] rounded-tl-[2px] bg-[#D9534F] text-white flex items-center justify-center text-[10px] font-bold" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 70%, 70% 100%, 0% 100%)' }}>00</div>
                        <span className="text-xs font-bold">You have not answered the question.</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-tr-[2px] rounded-bl-[10px] rounded-tl-[2px] rounded-br-[2px] bg-[#5CB85C] text-white flex items-center justify-center text-[10px] font-bold" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 30% 100%, 0% 70%)' }}>00</div>
                        <span className="text-xs font-bold">You have answered the question.</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-rose-800 text-white flex items-center justify-center text-[10px] font-bold">00</div>
                        <span className="text-xs font-bold">You have NOT answered but marked for review.</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-rose-800 text-white flex items-center justify-center text-[10px] font-bold relative">00 <div className="absolute right-0 bottom-0 w-2 h-2 bg-green-500 rounded-full border border-white"></div></div>
                        <span className="text-xs font-bold">The question(s) "Answered and Marked for Review" will be considered for evaluation.</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-rose-900 font-bold text-lg mb-4 border-b-2 border-rose-100 pb-2 flex items-center gap-2">
                    <span className="w-6 h-6 bg-rose-100 text-rose-900 rounded-full flex items-center justify-center text-xs">2</span>
                    Marking Scheme (NTA Standard)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-black text-green-700 uppercase mb-1">Correct Answer</p>
                      <p className="text-2xl font-black text-green-700">+4 Marks</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-black text-red-700 uppercase mb-1">Incorrect Answer</p>
                      <p className="text-2xl font-black text-red-700">-1 Mark</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Unattempted</p>
                      <p className="text-2xl font-black text-slate-700">0 Marks</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-4 italic">* For Numerical Value questions, negative marking may not apply. Please refer to specific question instructions.</p>
                </section>

                <section className="bg-rose-50/50 p-6 rounded-2xl border border-rose-100">
                  <h3 className="text-rose-900 font-bold text-base mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" /> AI Proctoring Compliance
                  </h3>
                  <ul className="text-xs space-y-2 text-slate-600 font-medium">
                    <li>• Switching tabs or minimizing the browser will trigger a malpractice warning.</li>
                    <li>• After <span className="text-red-600 font-bold">3 violations</span>, the test will be automatically terminated.</li>
                    <li>• Your camera must be active and your face must be clearly visible throughout the exam.</li>
                  </ul>
                </section>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 px-6 py-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={hasAcceptedRules}
                    onChange={(e) => setHasAcceptedRules(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" 
                  />
                  <span className="text-xs sm:text-sm font-bold text-gray-700 group-hover:text-rose-900 transition-colors">
                    I have read and understood the instructions.
                  </span>
                </label>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button 
                    onClick={onExit}
                    className="px-8 py-3 border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all uppercase text-sm"
                  >
                    Exit
                  </button>
                  <button
                    disabled={!hasAcceptedRules}
                    onClick={() => setVerificationStep('proctoring')}
                    className={`flex items-center gap-2 px-10 py-3 rounded-xl font-black uppercase tracking-tight transition-all
                      ${hasAcceptedRules 
                        ? 'bg-primary text-white shadow-lg hover:bg-primary/90 hover:scale-[1.02] active:scale-95' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
                    `}
                  >
                    Proceed <Play className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Phase 2: Proctoring (Existing logic) */
            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 sm:p-10 border border-white/10 shadow-2xl">
              
              {/* Camera Preview Side */}
              <div className="flex flex-col gap-6">
                <div className="aspect-video bg-black rounded-2xl overflow-hidden relative border-4 border-slate-700 shadow-inner group">
                  {isCameraActive ? (
                     <video
                      ref={previewVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover -scale-x-100"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-4">
                      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center animate-pulse">
                        <Camera className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-medium">Camera not active</p>
                    </div>
                  )}
                  
                  {/* Status Indicator Overlay */}
                  <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${isCameraActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                      {isCameraActive ? 'Live Preview' : 'Camera Off'}
                    </span>
                  </div>
                </div>

                {cameraError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="text-red-600 font-bold mb-1 uppercase dark:text-red-400">Permission Required</p>
                      <p className="text-slate-600 leading-relaxed dark:text-slate-300">
                        {cameraError}. Please enable camera access in your browser settings to continue.
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Back button to rules */}
                <button 
                  onClick={() => setVerificationStep('instructions')}
                  className="text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2 w-fit"
                >
                  &larr; Back to Instructions
                </button>
              </div>

              {/* Content Side */}
              <div className="flex flex-col gap-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 uppercase tracking-tight">Identity Verification</h2>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    To ensure exam integrity, please allow camera access and stay within the frame throughout the duration of the test.
                  </p>
                </div>

                {/* Checklist */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-2xl border border-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${isCameraActive ? 'bg-green-500/20 text-green-500' : 'bg-slate-700 text-slate-500'}`}>
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className={`text-sm font-bold ${isCameraActive ? 'text-white' : 'text-slate-500'}`}>Camera Permission</span>
                    </div>
                    {isCameraActive ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-2xl border border-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${isFaceDetected ? 'bg-green-500/20 text-green-500' : 'bg-slate-700 text-slate-500'}`}>
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <span className={`text-sm font-bold ${isFaceDetected ? 'text-white' : 'text-slate-500'}`}>Face Visible</span>
                    </div>
                    {isFaceDetected ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />}
                  </div>
                </div>

                <div className="mt-auto pt-4 flex flex-col gap-4">
                  <button
                    disabled={!isCameraActive || !isFaceDetected}
                    onClick={() => {
                      setIsExamStarted(true);
                      questionStartedAtRef.current = Date.now();
                    }}
                    className={`w-full group relative flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-lg transition-all
                      ${(isCameraActive && isFaceDetected) 
                        ? 'bg-primary hover:bg-rose-500 text-white shadow-[0_0_30px_rgba(225,29,72,0.4)] hover:scale-[1.02] active:scale-95' 
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'}
                    `}
                  >
                    <Play className={`w-6 h-6 fill-current ${isCameraActive && isFaceDetected ? 'animate-pulse' : ''}`} />
                    START EXAMINATION
                  </button>
                  <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest">
                    By starting, you agree to being monitored via AI proctoring
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. Top Header */}
      <header className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-6 py-2 border-b border-gray-300 gap-3 sm:gap-0">
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center cursor-pointer" onClick={() => { stopCamera(); onExit(); }}>
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
              <div className="w-6 h-6 bg-orange-500 rounded-tr-xl rounded-bl-xl" style={{ clipPath: 'polygon(0% 100%, 100% 100%, 100% 0%)' }}></div>
            </div>
          </div>
          <div>
            <h1 className="text-sm sm:text-xl font-bold text-rose-900 leading-tight">O3 ORIGIN TESTING AGENCY</h1>
            <p className="text-[10px] sm:text-xs text-green-700 font-semibold italic">Excellence in Assessment</p>
          </div>
        </div>

        <div className="flex items-center justify-between w-full sm:w-auto gap-4 text-xs font-semibold">
          <div className="w-16 h-20 sm:w-24 sm:h-28 bg-gray-600 rounded-lg flex flex-col items-center justify-center overflow-hidden relative shadow-inner border-2 border-gray-400">
            {proctorStatus === 'error' ? (
              <div className="flex flex-col items-center justify-center text-red-100 p-2 bg-red-900/50 w-full h-full">
                <Camera className="w-5 h-5 sm:w-6 sm:h-6 mb-2" />
                <span className="text-[8px] sm:text-[10px] text-center font-bold tracking-tighter">ACCESS DENIED</span>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover opacity-100 -scale-x-100"
                />
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.8)]"></div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white py-0.5 text-center flex items-center justify-center gap-1">
                  {proctorStatus === 'warning' ? (
                    <span className="text-yellow-400 flex items-center">
                      <AlertTriangle className="w-2 h-2 mr-0.5" /> MOBILE?
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <ShieldCheck className="w-2 h-2 mr-0.5 text-green-400" /> PROCTORING
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-0.5 sm:gap-1 text-[10px] sm:text-xs">
            <div className="flex"><span className="w-20 sm:w-28 text-gray-500">Candidate:</span> <span className="text-orange-500 truncate max-w-[100px] sm:max-w-none">[Your Name]</span></div>
            <div className="flex"><span className="w-20 sm:w-28 text-gray-500">Subject:</span> <span className="text-orange-500 truncate max-w-[100px] sm:max-w-none">{test.title}</span></div>
            <div className="flex"><span className="w-20 sm:w-28 text-gray-500">Remaining:</span> <span className="bg-rose-500 text-white px-2 py-0.5 rounded text-[10px] sm:text-xs" suppressHydrationWarning>{formatTime(effectiveTimeRemaining)}</span></div>
          </div>
        </div>
      </header>

      {/* 2. Section/Subject Header */}
      <div className="bg-[#f08c32] px-3 sm:px-6 py-0 flex justify-between items-center text-[10px] sm:text-xs overflow-visible">
        <div className="flex gap-0 items-center h-[40px]">
          <div className="flex bg-primary text-white px-4 h-full items-center font-bold text-xs border-r border-white/20 whitespace-nowrap">
            SECTION
          </div>
          {subjects.map((subj) => {
            const isActive = activeSubject === subj;
            const stats = getSubjectStats(subj);
            return (
              <div key={subj} className="group relative h-full flex items-center">
                <button
                  onClick={() => {
                    const firstIdx = test.questions.findIndex(q => q.subject === subj);
                    if (firstIdx !== -1) navigateToQuestion(firstIdx);
                  }}
                  className={`h-full px-4 text-xs font-bold uppercase transition-all flex items-center gap-2 border-r border-white/20 ${
                    isActive ? 'bg-white text-black' : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                >
                  {subj}
                  <div className="p-0.5 hover:bg-black/10 rounded cursor-help">
                    <Info className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Legend Tooltip */}
                <div className="absolute top-full left-0 mt-0 w-72 bg-white shadow-2xl rounded-b-md border border-gray-200 z-[100] hidden group-hover:block p-4 pointer-events-none">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-tr-[16px] rounded-br-[4px] rounded-tl-[4px] bg-[#D9534F] text-white flex-shrink-0 flex items-center justify-center font-bold shadow-sm" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 70%, 70% 100%, 0% 100%)' }}>
                        {stats.not_answered.toString().padStart(2, '0')}
                      </div>
                      <p className="text-[11px] text-gray-700 font-bold uppercase leading-tight mt-1">You have not answered the question.</p>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-tr-[4px] rounded-bl-[16px] rounded-tl-[4px] rounded-br-[4px] bg-[#5CB85C] text-white flex-shrink-0 flex items-center justify-center font-bold shadow-sm" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 30% 100%, 0% 70%)' }}>
                        {stats.answered.toString().padStart(2, '0')}
                      </div>
                      <p className="text-[11px] text-gray-700 font-bold uppercase leading-tight mt-1">You have answered the question.</p>
                    </div>
                     <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-rose-800 text-white flex-shrink-0 flex items-center justify-center font-bold shadow-sm">
                        {stats.marked_review.toString().padStart(2, '0')}
                      </div>
                      <p className="text-[11px] text-gray-700 font-bold uppercase leading-tight mt-1">You have NOT answered but marked for review.</p>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-rose-800 text-white flex-shrink-0 flex items-center justify-center font-bold shadow-sm relative">
                        {stats.answered_marked.toString().padStart(2, '0')}
                        <div className="absolute right-0 bottom-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-white"></div>
                      </div>
                      <p className="text-[11px] text-gray-700 font-bold uppercase leading-tight mt-0.5">The question(s) "Answered and Marked for Review" will be considered for evaluation.</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 sm:gap-6 ml-4">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold hidden sm:inline">Paper Language:</span>
            <select className="border border-gray-300 text-black px-1.5 py-0.5 sm:px-2 sm:py-1 bg-white outline-none w-24 sm:w-48 text-[10px] sm:text-xs">
              <option>English</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>

        {/* Left Area - Question Content */}
        <div className="flex-1 flex flex-col border-r border-gray-300 relative">

          {/* Question Header */}
          <div className="flex justify-between items-center px-4 py-2 border-b border-gray-300 font-bold text-base sm:text-lg border-t-4 border-t-white bg-slate-50 dark:bg-slate-900 text-foreground sticky top-0 z-20">
            <span>Question {currentQuestionIndex + 1}:</span>
            <div className="w-6 h-6 bg-primary rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm">&darr;</div>
          </div>

          {/* Question Text & Options */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 relative">
            <div className="absolute right-0 top-[50%] bg-black text-white px-1 py-4 cursor-pointer text-xs"><b>&gt;</b></div>
            <div className="max-w-3xl">

              {/* Added Tags rendering for Phase 7 */}
              {currentQuestion?.tags && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {(typeof currentQuestion.tags === 'string' ? currentQuestion.tags.split(',') : Array.isArray(currentQuestion.tags) ? currentQuestion.tags : []).map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 bg-rose-50 text-primary border border-rose-100 rounded-md text-[10px] font-bold uppercase tracking-wider">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}

              <div className="text-base text-gray-800 leading-relaxed font-serif mb-8 whitespace-pre-wrap">
                {renderQuestionText(currentQuestion?.text || '', 'test-question')}
              </div>

              {(currentQuestion?.questionType === 'mcq' || !currentQuestion?.questionType) && (
                <div className="space-y-4 font-serif text-base">
                  {currentQuestion?.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleOptionSelect(idx)}
                      className={cn(
                        "w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-start gap-4 text-left group",
                        tempSelection === idx
                          ? "border-primary bg-rose-50 shadow-md shadow-rose-100"
                          : "border-slate-100 hover:border-rose-200 hover:bg-slate-50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold border-2 transition-colors",
                        tempSelection === idx
                          ? "bg-primary border-primary text-white"
                          : "bg-white border-slate-200 text-slate-500 group-hover:border-rose-300 group-hover:text-primary"
                      )}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <div className="flex-1 pt-1">
                        <span className="text-slate-900 font-medium">{renderInlineSegments(String(option), `test-mcq-option-${idx}`, 'plain')}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion?.questionType === 'msq' && (
                <div className="space-y-4 font-serif text-base">
                  <p className="text-xs font-bold text-primary mb-2 uppercase tracking-tight">Multiple Correct Concept</p>
                  {currentQuestion?.options.map((option, idx) => (
                    <label key={idx} className="flex items-start gap-4 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={tempSelections.includes(idx)}
                        onChange={() => {
                          setTempSelections(prev =>
                            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                          );
                        }}
                        className="mt-1.5 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="group-hover:text-primary transition-colors">({idx + 1})</span>
                      <span className="group-hover:text-primary transition-colors">
                        {renderInlineSegments(String(option), `test-msq-option-${idx}`, 'plain')}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {currentQuestion?.questionType === 'matrix_match' && currentQuestion.matrixData && (
                <div className="space-y-6 font-serif text-base">
                  <p className="text-xs font-bold text-primary mb-4 uppercase tracking-tight">Matrix Matching</p>
                  
                  {/* Column B Reference (Sync with OGCode) */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Column B Reference</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {currentQuestion.matrixData.column_b.map((term: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
                          <span className="w-5 h-5 rounded bg-rose-50 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs text-gray-700">{renderInlineSegments(String(term), `test-matrix-term-${idx}`, 'plain')}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {currentQuestion.matrixData.column_a.map((itemA: string, idxA: number) => (
                      <div key={idxA} className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] font-bold">
                            {String.fromCharCode(80 + idxA)}
                          </span>
                          <span className="text-sm font-semibold text-gray-800">{renderInlineSegments(String(itemA), `test-matrix-item-${idxA}`, 'plain')}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(currentQuestion as any).matrixData.column_b.map((_: any, idxB: number) => {
                            const isSelected = tempMatrixPairs.some(p => p[0] === idxA && p[1] === idxB);
                            return (
                              <button
                                key={idxB}
                                onClick={() => {
                                  setTempMatrixPairs(prev => {
                                    const exists = prev.some(p => p[0] === idxA && p[1] === idxB);
                                    if (exists) return prev.filter(p => !(p[0] === idxA && p[1] === idxB));
                                    return [...prev, [idxA, idxB]];
                                  });
                                }}
                                className={`px-4 py-1.5 rounded text-xs font-bold transition-all border
                                  ${isSelected
                                    ? 'bg-primary border-primary text-white shadow-md'
                                    : 'bg-white border-gray-300 text-gray-600 hover:border-rose-400'}
                                `}
                              >
                                {idxB + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentQuestion?.questionType === 'numerical' && (
                <div className="font-serif text-base">
                  <p className="text-xs font-bold text-primary mb-4 uppercase tracking-tight">Numerical Value Type</p>
                  <div className="flex flex-col gap-4">
                    <input
                      type="number"
                      step="any"
                      value={tempTextAnswer}
                      onChange={handleTextChange}
                      className="border-2 border-slate-300 rounded-md p-3 w-64 text-2xl font-mono text-center focus:border-primary focus:ring-4 focus:ring-rose-100 outline-none transition-all"
                      placeholder="0.00"
                    />
                    <p className="text-[10px] text-gray-500 italic">* Round off to nearest two decimal places if required.</p>
                  </div>
                </div>
              )}

              {currentQuestion?.questionType === 'subjective' && (
                <div className="font-serif text-base w-full">
                  <p className="text-sm font-bold text-slate-500 mb-2 uppercase">Write your answer:</p>
                  <textarea
                    value={tempTextAnswer}
                    onChange={handleTextChange}
                    className="border-2 border-slate-300 rounded-md p-4 w-full h-32 text-base font-sans focus:border-rose-500 outline-none resize-y"
                    placeholder="Type your explanation or answer here..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-gray-300 px-3 sm:px-4 py-2 sm:py-3 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shadow-sm">
            <div className="flex gap-2">
              <button onClick={markForReviewAndNext} className="bg-primary text-white px-2 sm:px-4 py-2 sm:py-2.5 font-bold text-[10px] sm:text-xs rounded-sm hover:opacity-90 uppercase flex flex-col items-center leading-tight">
                MARK FOR REVIEW & NEXT
                <span className="text-[7px] lowercase font-medium opacity-80">(will be counted for evaluation)</span>
              </button>
              <button onClick={handleClearResponse} className="bg-white text-gray-800 border border-gray-300 px-2 sm:px-4 py-2 sm:py-2.5 font-bold text-[10px] sm:text-xs rounded-sm hover:bg-gray-50 uppercase shadow-sm">
                CLEAR RESPONSE
              </button>
            </div>
            <button onClick={saveAndNext} className="bg-[#5CB85C] text-white px-4 sm:px-8 py-2 sm:py-2.5 font-bold text-[10px] sm:text-xs rounded-sm hover:opacity-90 uppercase flex flex-col items-center leading-tight">
              SAVE & NEXT
              <span className="text-[7px] lowercase font-medium opacity-80">(save the question)</span>
            </button>
          </div>
        </div>

        {/* Right Area - Palette */}
        <div className="w-full lg:w-[350px] bg-slate-50 dark:bg-slate-900 flex flex-col pt-4 border-t lg:border-t-0 lg:border-l border-gray-300 max-h-[300px] lg:max-h-none">

          {/* Legend */}
          <div className="px-4 pb-4 border-b border-gray-200">
            <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[10px] text-gray-700 font-semibold mb-4">

              <div className="flex items-center gap-1.5">
                <div className="w-8 h-7 bg-gray-200 border border-gray-300 rounded-sm flex items-center justify-center font-bold text-gray-500 relative">
                  <span className="bg-white px-1 leading-none z-10">{stats.not_visited}</span>
                </div>
                <span className="leading-tight w-20">Not Visited</span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="w-8 h-8 rounded-tr-[16px] rounded-br-[4px] rounded-tl-[4px] bg-[#D9534F] text-white flex items-center justify-center font-bold shadow-sm relative overflow-hidden" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 70%, 70% 100%, 0% 100%)' }}>
                  {stats.not_answered}
                  <div className="absolute -top-2 -right-2 w-4 h-4 bg-white/20 rotate-45"></div>
                </div>
                <span className="leading-tight">Not Answered</span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="w-8 h-8 rounded-tr-[4px] rounded-bl-[16px] rounded-tl-[4px] rounded-br-[4px] bg-[#5CB85C] text-white flex items-center justify-center font-bold shadow-sm" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 30% 100%, 0% 70%)' }}>
                  {stats.answered}
                </div>
                <span className="leading-tight">Answered</span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-rose-800 text-white flex items-center justify-center font-bold shadow-sm">
                  {stats.marked}
                </div>
                <span className="leading-tight">Marked for Review</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-gray-700 font-semibold mt-1">
              <div className="w-8 h-8 rounded-full bg-rose-800 text-white flex items-center justify-center font-bold shadow-sm relative">
                {stats.answered_marked}
                <div className="absolute right-0 bottom-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-white"></div>
              </div>
              <span className="leading-tight flex-1">Answered & Marked for Review (will be considered for evaluation)</span>
            </div>
          </div>

          {/* Palette Grid */}
          <div className="flex-1 p-4 bg-rose-50/30 overflow-y-auto">
            <div className="bg-[#EBEBEB] text-primary font-bold py-1 px-2 border-b border-primary text-xs uppercase mb-2 inline-block">
              {test.title}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-y-2 gap-x-1 justify-items-center">
              {test.questions.map((_, i) => {
                const status = getQuestionStatus(i);
                let shapeClass = "w-10 h-9 font-bold text-sm flex items-center justify-center relative";
                let innerContent = (i + 1).toString().padStart(2, '0');

                if (status === 'not_visited') {
                  shapeClass += " bg-white border border-gray-400 text-gray-800 rounded-sm";
                } else if (status === 'not_answered') {
                  shapeClass += " text-white";
                  innerContent = <div className="absolute inset-0 bg-[#D9534F] flex items-center justify-center" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 70%, 70% 100%, 0% 100%)' }}>{innerContent}</div> as any;
                } else if (status === 'answered') {
                  shapeClass += " text-white";
                  innerContent = <div className="absolute inset-0 bg-[#5CB85C] flex items-center justify-center" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 30% 100%, 0% 70%)' }}>{innerContent}</div> as any;
                } else if (status === 'marked_review') {
                  shapeClass += " text-white";
                  innerContent = <div className="absolute inset-0 bg-rose-800 rounded-full flex items-center justify-center w-9 h-9 mx-auto">{innerContent}</div> as any;
                } else if (status === 'answered_marked') {
                  shapeClass += " text-white";
                  innerContent = <div className="absolute inset-0 mx-auto w-9 h-9"><div className="w-full h-full bg-rose-800 rounded-full flex items-center justify-center">{innerContent}</div><div className="absolute right-0 bottom-0 w-3 h-3 bg-[#5CB85C] rounded-full border border-white"></div></div> as any;
                }

                return (
                  <button onClick={() => navigateToQuestion(i)} key={i} className={shapeClass}>
                    {innerContent}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-200 mt-auto">
             <button 
               onClick={() => setShowSubmitModal(true)} 
               className="w-full bg-[#5CB85C] text-white py-3 font-bold text-sm rounded hover:bg-green-600 uppercase shadow-lg transition-all active:scale-95"
             >
               SUBMIT
             </button>
          </div>
        </div>

      </div>

      {mobileDetected && (
        <div className="fixed inset-0 z-[100] bg-red-950/20 backdrop-blur-[2px] pointer-events-none flex flex-col items-center justify-center animate-in fade-in duration-500">
          <div className="bg-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce border-4 border-white/20">
            <div className="p-3 bg-white/20 rounded-full">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xl font-black uppercase tracking-tighter">Mobile Device Detected!</p>
              <p className="text-sm font-medium opacity-90">Avoid using mobile phones. This incident is being recorded.</p>
            </div>
          </div>
        </div>
      )}

      {showMalpracticeWarning && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-white rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.2)] max-w-md w-full overflow-hidden border-t-8 border-yellow-500">
            <div className="bg-yellow-500/10 p-8 text-center border-b border-yellow-100">
              <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-500/40">
                <AlertTriangle className="w-10 h-10 text-white animate-pulse" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-2 uppercase tracking-tighter">Warning: Security Alert</h2>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white text-xs font-black rounded-full uppercase tracking-widest mb-4">
                Violation {violations} of 3
              </div>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <p className="text-gray-900 font-bold text-center text-lg italic">"Unauthorized tab switching detected"</p>
                <p className="text-gray-500 text-sm text-center leading-relaxed">
                  The system has recorded that you attempted to leave the examination screen. 
                  This is a direct violation of the <span className="font-bold text-primary">O3 Testing Agency</span> proctoring guidelines.
                </p>
              </div>

              <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                <p className="text-red-700 text-[10px] font-black uppercase tracking-widest text-center">Final Warning Consequences</p>
                <p className="text-red-600 text-[11px] font-bold text-center mt-1">
                  Exceeding 3 violations will result in automatic test termination and disqualification.
                </p>
              </div>

              <button
                onClick={() => setShowMalpracticeWarning(false)}
                className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl transition-all shadow-xl active:scale-95 text-lg uppercase tracking-tight"
              >
                Return to Examination
              </button>
            </div>
          </div>
        </div>
      )}

      {isMalpracticeTerminated && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-red-950/90 backdrop-blur-md p-4 animate-in fade-in duration-500">
          <div className="bg-white rounded-3xl shadow-[0_0_50px_rgba(239,68,68,0.3)] max-w-md w-full p-10 text-center border-t-8 border-red-600">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
              <ShieldCheck className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-3xl font-black text-red-600 mb-4 uppercase tracking-tighter">Test Terminated</h2>
            <p className="text-xl font-bold text-gray-900 mb-2">MALPRACTICE DETECTED</p>
            <p className="text-gray-600 mb-10 leading-relaxed font-semibold">
              You have exceeded the maximum number of warnings for leaving the test screen.
              The test has been suspended and reported.
            </p>
            <div className="flex items-center justify-center gap-3 text-red-600 font-bold animate-bounce text-lg">
              <span className="w-2 h-2 bg-red-600 rounded-full"></span>
              SUBMITTING RESULTS...
            </div>
          </div>
        </div>
      )}

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Submit Exam</h2>
            <p className="text-gray-600 text-sm mb-6">Are you sure you want to submit the exam? Once submitted, you cannot change your answers.</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-6 py-2 border border-primary text-primary font-bold rounded hover:bg-rose-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => finalSubmit()}
                className="px-6 py-2 bg-primary text-white font-bold rounded hover:bg-primary/90 transition-colors shadow-md"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submitting overlay for manual submission */}
      {isSubmitting && !isMalpracticeTerminated && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
          <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-2">Submitting Exam...</h2>
          <p className="text-gray-600 font-medium text-center max-w-md">
            Please wait while we securely submit your answers and generate AI insights.
          </p>
        </div>
      )}
      {showRefreshWarning && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border-t-8 border-orange-500">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tight">Reload Detected</h2>
            <p className="text-gray-600 mb-8 font-medium">
              Refreshing the page will cause your exam to be <span className="text-red-600 font-bold">AUTOMATICALLY SUBMITTED</span>. 
              Do you want to submit and reload?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowRefreshWarning(false);
                  finalSubmit();
                }}
                className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors uppercase tracking-wide"
              >
                Yes, Submit and Reload
              </button>
              <button
                onClick={() => setShowRefreshWarning(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-wide"
              >
                No, Continue Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
