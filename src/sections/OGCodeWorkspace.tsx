'use client';
import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import {
    ArrowLeft, Play, Clock, Loader2, CheckCircle2,
    XCircle, RotateCcw, Trophy, X, HelpCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api';
import { usePublishOriginAiPageContext } from '@/features/origin-ai/page-context-store';
import { readOgcodeNavQueue, saveOgcodeNavQueue, getOgcodeNeighbours, type OgcodeNavQueue } from '@/features/ogcode/nav-queue';
import {
    formatMathExpression as sharedFormatMathExpression,
    hasMathMarkup as sharedHasMathMarkup,
} from '@/lib/math-text';
import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import type { PracticeQuestion, User } from '@/types';
import { submitOgcodeAnswerAction } from '@/server/actions/ogcode-actions';
import { toast } from 'sonner';

const SUBJECT_META: Record<string, { label: string; emoji: string; param: string }> = {
    phy:  { label: 'Physics',     emoji: '⚛️', param: 'subject=phy'  },
    chem: { label: 'Chemistry',   emoji: '🧪', param: 'subject=chem' },
    math: { label: 'Mathematics', emoji: '📐', param: 'subject=math' },
    bio:  { label: 'Biology',     emoji: '🌿', param: 'subject=bio'  },
};

const SUBJECT_ORI_MAP: Record<string, string> = {
    phy:  '/ori2d/ori-physics.png',
    chem: '/ori2d/ori-chemistry.png',
    math: '/ori2d/ori-maths.png',
    bio:  '/ori2d/ori-biology.png',
};

interface OGCodeWorkspaceProps {
    questionId: string | number;
    onBack: () => void;
    onRefreshUser?: () => void;
    setTimeMode?: (mode: 'webpage' | 'practice' | 'pomodoro', subject?: string) => void;
    user: User;
    /**
     * Server-seeded question payload. When present, the workspace renders
     * immediately with no client fetch for the initial question.
     */
    initialQuestion?: PracticeQuestion | null;
}

interface SubmitResult {
    isCorrect: boolean;
    already_solved?: boolean;
    correctOption?: number;
    correctOptions?: number[];
    presentationId?: string;
    presentation_id?: string;
    correctPairs?: number[][];
    correctAnswerText?: string;
    explanation?: string;
    resultScore?: number;
    maxPoints?: number;
    pointsAwarded?: number;
    basePoints?: number;
    timeSpentSeconds?: number;
    targetTimeSeconds?: number;
    speedMultiplier?: number;
    speedBand?: 'blazing' | 'fast' | 'steady' | 'deliberate' | 'slow';
}

type SubmitPayload = {
    timeSpent: number;
    selectedOption?: number | null;
    selectedOptions?: number[];
    presentationId?: string | null;
    presentation_id?: string | null;
    matrixPairs?: number[][];
    answerText?: string;
};

type PracticeQuestionApi = PracticeQuestion & {
    question_type?: PracticeQuestion['questionType'];
    matrix_data?: PracticeQuestion['matrixData'] | string;
    explanation?: string;
    answerText?: string;
    attempted?: boolean;
    attemptCount?: number;
};

type SubmitResultApi = SubmitResult & {
    correct_pairs?: number[][];
};

const DIFFICULTY_CONFIG = {
    easy: { label: 'Easy', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    medium: { label: 'Medium', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    hard: { label: 'Hard', color: 'text-rose-400', bg: 'bg-rose-500/10' },
    insane: { label: 'Insane', color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

const SPEED_BAND_LABELS = {
    blazing: 'Blazing',
    fast: 'Fast',
    steady: 'Steady',
    deliberate: 'Deliberate',
    slow: 'Slow',
} as const;

const LATEX_COMMAND_MAP: Record<string, string> = {
    alpha: 'α',
    beta: 'β',
    gamma: 'γ',
    delta: 'δ',
    epsilon: 'ε',
    theta: 'θ',
    lambda: 'λ',
    mu: 'μ',
    pi: 'π',
    rho: 'ρ',
    sigma: 'σ',
    phi: 'φ',
    omega: 'ω',
    times: '×',
    cdot: '·',
    circ: '°',
    pm: '±',
    mp: '∓',
    leq: '≤',
    geq: '≥',
    neq: '≠',
    infty: '∞',
    propto: '∝',
    to: '→',
    rightarrow: '→',
    leftarrow: '←',
};

const SUPERSCRIPT_DIGITS: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
    '+': '⁺',
    '-': '⁻',
    '=': '⁼',
    '(': '⁽',
    ')': '⁾',
    n: 'ⁿ',
    i: 'ⁱ',
};

const SUBSCRIPT_DIGITS: Record<string, string> = {
    '0': '₀',
    '1': '₁',
    '2': '₂',
    '3': '₃',
    '4': '₄',
    '5': '₅',
    '6': '₆',
    '7': '₇',
    '8': '₈',
    '9': '₉',
    '+': '₊',
    '-': '₋',
    '=': '₌',
    '(': '₍',
    ')': '₎',
};

function mapDecoratedText(value: string, alphabet: Record<string, string>): string {
    return Array.from(value).map((char) => alphabet[char] ?? char).join('');
}

function extractBalancedSegment(value: string, startIndex: number, openChar: string, closeChar: string) {
    if (value[startIndex] !== openChar) {
        return null;
    }

    let depth = 0;
    let cursor = startIndex;
    for (; cursor < value.length; cursor += 1) {
        const current = value[cursor];
        if (current === openChar) {
            depth += 1;
        } else if (current === closeChar) {
            depth -= 1;
            if (depth === 0) {
                return {
                    content: value.slice(startIndex + 1, cursor),
                    endIndex: cursor,
                };
            }
        }
    }

    return null;
}

function replaceFractions(value: string): string {
    let output = '';
    let cursor = 0;

    while (cursor < value.length) {
        if (value.startsWith('\\frac', cursor)) {
            let nextCursor = cursor + 5;
            while (value[nextCursor] === ' ') {
                nextCursor += 1;
            }

            const numerator = extractBalancedSegment(value, nextCursor, '{', '}');
            if (!numerator) {
                output += value[cursor];
                cursor += 1;
                continue;
            }

            nextCursor = numerator.endIndex + 1;
            while (value[nextCursor] === ' ') {
                nextCursor += 1;
            }

            const denominator = extractBalancedSegment(value, nextCursor, '{', '}');
            if (!denominator) {
                output += value[cursor];
                cursor += 1;
                continue;
            }

            output += `(${formatMathExpression(numerator.content)})/(${formatMathExpression(denominator.content)})`;
            cursor = denominator.endIndex + 1;
            continue;
        }

        output += value[cursor];
        cursor += 1;
    }

    return output;
}

function replaceSquareRoots(value: string): string {
    let output = '';
    let cursor = 0;

    while (cursor < value.length) {
        if (value.startsWith('\\sqrt', cursor) || value[cursor] === '√') {
            cursor += value.startsWith('\\sqrt', cursor) ? 5 : 1;
            while (value[cursor] === ' ') {
                cursor += 1;
            }

            if (value[cursor] === '{' || value[cursor] === '(') {
                const openChar = value[cursor];
                const closeChar = openChar === '{' ? '}' : ')';
                const segment = extractBalancedSegment(value, cursor, openChar, closeChar);
                if (segment) {
                    output += `√(${formatMathExpression(segment.content)})`;
                    cursor = segment.endIndex + 1;
                    continue;
                }
            }

            const tokenMatch = value.slice(cursor).match(/^[a-zA-Z0-9.]+/);
            if (tokenMatch) {
                output += `√(${tokenMatch[0]})`;
                cursor += tokenMatch[0].length;
                continue;
            }

            output += '√';
            continue;
        }

        output += value[cursor];
        cursor += 1;
    }

    return output;
}

function formatMathExpression(input: string | null | undefined): string {
    return sharedFormatMathExpression(input);
}

function hasMathMarkup(value: string | null | undefined): boolean {
    return sharedHasMathMarkup(value);
}

function isEquationHeavyLine(value: string): boolean {
    const text = value.replace(/\*\*/g, '').trim();
    if (!text) {
        return false;
    }

    const latexSignalCount = [
        /\\frac/g,
        /\\sqrt/g,
        /\\(?:tan|sin|cos|cot|sec|csc|log|ln)\b/g,
        /\\(?:alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|phi|omega)\b/g,
    ].reduce((count, pattern) => count + (text.match(pattern)?.length ?? 0), 0);

    const symbolSignalCount = [
        /=/g,
        /→/g,
        /∝/g,
        /√/g,
        /\//g,
    ].reduce((count, pattern) => count + (text.match(pattern)?.length ?? 0), 0);

    const startsLikeEquation = /^((\\)?(?:tan|sin|cos|cot|sec|csc|log|ln)\s*\(|[A-Za-zα-ωΑ-Ωβθλμπσφω][A-Za-z0-9_{}\\^()]*\s*=|[0-9(\\√])/i.test(text);
    const hasEquationCore = /=/.test(text) || /\\frac|\\sqrt|\\(?:tan|sin|cos|cot|sec|csc)\b/.test(text);

    return (hasEquationCore && (latexSignalCount + symbolSignalCount >= 2 || startsLikeEquation))
        || (startsLikeEquation && latexSignalCount >= 1);
}

function renderInlineSegments(value: string, keyPrefix: string): ReactNode {
    return <FormattedMessage content={value || ''} inline />;
}

function renderFormattedExplanation(content: string | null | undefined): ReactNode {
    return <FormattedMessage content={content || ''} />;
}

function renderQuestionText(content: string | null | undefined, keyPrefix: string): ReactNode {
    return <FormattedMessage content={content || ''} />;
}

export default function OGCodeWorkspace({ questionId, onBack, onRefreshUser, setTimeMode, user, initialQuestion }: OGCodeWorkspaceProps) {
    const [question, setQuestion] = useState<PracticeQuestion | null>(initialQuestion ?? null);
    const [isLoading, setIsLoading] = useState(!initialQuestion);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<SubmitResult | null>(null);

    // Answer states
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
    const [matrixPairs, setMatrixPairs] = useState<number[][]>([]);
    const [showHint, setShowHint] = useState(false);
    const [showSolution, setShowSolution] = useState(false);
    const [answerInput, setAnswerInput] = useState('');

    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasFetched = useRef(Boolean(initialQuestion));

    // Previous / Next navigation that follows the filter applied on the list.
    const router = useRouter();
    const [navQueue, setNavQueue] = useState<OgcodeNavQueue | null>(null);
    useEffect(() => {
        const existing = readOgcodeNavQueue();
        if (existing) {
            setNavQueue(existing);
            return;
        }
        // No queue from the list page — fetch all question IDs so navigation works on direct URL load.
        apiCall('/assessments/ogcode/questions/').then((data: unknown) => {
            const items = Array.isArray(data) ? data : [];
            const ids = items.map((q: { id: unknown }) => String(q.id)).filter(Boolean);
            if (ids.length === 0) return;
            const queue: OgcodeNavQueue = { ids, label: 'All Questions' };
            saveOgcodeNavQueue(queue);
            setNavQueue(queue);
        }).catch(() => { /* silently skip if fetch fails */ });
    }, []);
    const { prevId, nextId, index, total } = getOgcodeNeighbours(navQueue, String(questionId));
    const goToQuestion = useCallback((id: string | null) => {
        if (id) router.push(`/ogcode/${id}`);
    }, [router]);

    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const switchToSubject = useCallback(async (subjectKey: string) => {
        const meta = SUBJECT_META[subjectKey];
        if (!meta) return;
        try {
            const data = await apiCall(`/assessments/ogcode/questions/?${meta.param}`) as unknown;
            const items = Array.isArray(data) ? data : [];
            const ids = items.map((q: { id: unknown }) => String(q.id)).filter(Boolean);
            if (ids.length === 0) { toast.error(`No ${meta.label} questions found`); return; }
            const queue: OgcodeNavQueue = { ids, label: meta.label, filterParams: meta.param };
            saveOgcodeNavQueue(queue);
            setNavQueue(queue);
            router.push(`/ogcode/${ids[0]}`);
        } catch {
            toast.error(`Failed to load ${meta.label} questions`);
        }
    }, [router]);

    const loadMoreQuestions = useCallback(async () => {
        setIsLoadingMore(true);
        try {
            // Re-fetch with the same filter the user had on the list page (if any)
            const qs = navQueue?.filterParams ? `?${navQueue.filterParams}` : '';
            const data = await apiCall(`/assessments/ogcode/questions/${qs}`) as unknown;
            const items = Array.isArray(data) ? data : [];
            const incoming = items.map((q: { id: unknown }) => String(q.id)).filter(Boolean);
            const existingSet = new Set(navQueue?.ids ?? []);
            const fresh = incoming.filter(id => !existingSet.has(id));
            if (fresh.length > 0) {
                const merged = [...(navQueue?.ids ?? []), ...fresh];
                const queue: OgcodeNavQueue = { ids: merged, label: navQueue?.label ?? 'All Questions', filterParams: navQueue?.filterParams };
                saveOgcodeNavQueue(queue);
                setNavQueue(queue);
                router.push(`/ogcode/${fresh[0]}`);
            } else {
                // Determine current subject from filter params
                const currentSubjectKey = navQueue?.filterParams
                    ? new URLSearchParams(navQueue.filterParams).get('subject') ?? ''
                    : '';
                const currentLabel = SUBJECT_META[currentSubjectKey]?.label ?? (navQueue?.label ?? 'this topic');
                // Pick 2 random other subjects
                const suggestions = Object.keys(SUBJECT_META)
                    .filter(k => k !== currentSubjectKey)
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 2);

                toast.custom((toastId) => (
                    <div className="w-full max-w-sm rounded-2xl border border-border/40 bg-background p-4 shadow-xl">
                        <p className="text-sm font-semibold text-foreground">
                            🚧 More {currentLabel} questions coming soon!
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            We&apos;re working hard on adding more. How about practising:
                        </p>
                        <div className="mt-3 flex gap-2">
                            {suggestions.map(key => {
                                const m = SUBJECT_META[key];
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => { toast.dismiss(toastId); switchToSubject(key); }}
                                        className="flex items-center gap-1.5 rounded-xl neu-raised px-3 py-1.5 text-xs font-bold text-foreground transition-all hover:-translate-y-0.5"
                                    >
                                        <span>{m.emoji}</span> {m.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ), { duration: 12000 });
            }
        } catch {
            toast.error('Failed to load more questions');
        } finally {
            setIsLoadingMore(false);
        }
    }, [navQueue, router, switchToSubject]);

    // 1. SAFE TAGS: Prevents the ".map is not a function" crash
    const safeTags = useMemo(() => {
        if (!question?.tags) return [];
        if (Array.isArray(question.tags)) return question.tags;
        if (typeof question.tags === 'string') return question.tags.split(',').filter(Boolean);
        return [];
    }, [question?.tags]);

    const originAiPageContext = useMemo(() => {
        const attempted = Boolean(
            result ||
            question?.attempted ||
            question?.attemptCount ||
            question?.status === 'attempted' ||
            question?.status === 'solved' ||
            question?.isSolved,
        );
        const solved = Boolean(result?.isCorrect || question?.isSolved || question?.status === 'solved');

        return {
            pathname: typeof questionId === 'string' ? `/ogcode/${questionId}` : '/ogcode',
            pageKind: 'ogcode_question' as const,
            questionId: String(questionId),
            questionTitle: question?.text ?? null,
            questionHint: question?.hint ?? null,
            questionSolution: result?.correctAnswerText ?? question?.answerText ?? null,
            questionExplanation: result?.explanation ?? question?.explanation ?? null,
            questionSubject: question?.subject ?? null,
            questionChapter: question?.chapter ?? null,
            questionConcept: question?.concept ?? null,
            questionDifficulty: question?.difficulty ?? null,
            questionAttempted: attempted,
            questionSolved: solved,
        };
    }, [question, questionId, result]);

    usePublishOriginAiPageContext(originAiPageContext);

    // 2. FETCH: Prevents infinite API loop
    const fetchQuestion = useCallback(async () => {
        if (hasFetched.current) return;
        setIsLoading(true);
        try {
            const data = await apiCall(`/assessments/practice/${questionId}/`);
            setQuestion(data);
            hasFetched.current = true;
        } catch (err) { 
            console.error("Fetch error:", err);
            toast.error('Failed to load question details.'); 
            onBack();
        }
        finally { setIsLoading(false); }
    }, [questionId, onBack]);

    useEffect(() => {
        fetchQuestion();
    }, [fetchQuestion]);

    // Navigating Prev/Next changes `questionId` without necessarily remounting
    // this component. Reset per-question state and reload the new question.
    const prevQuestionIdRef = useRef(String(questionId));
    useEffect(() => {
        const idStr = String(questionId);
        if (prevQuestionIdRef.current === idStr) return;
        prevQuestionIdRef.current = idStr;
        setResult(null);
        setSelectedOption(null);
        setSelectedOptions([]);
        setMatrixPairs([]);
        setShowHint(false);
        setShowSolution(false);
        setAnswerInput('');
        setElapsed(0);
        if (initialQuestion && String(initialQuestion.id) === idStr) {
            setQuestion(initialQuestion);
            hasFetched.current = true;
        } else {
            setQuestion(null);
            hasFetched.current = false;
        }
    }, [questionId, initialQuestion]);

    useEffect(() => {
        if (isLoading || result) return;

        timerRef.current = setInterval(() => {
            setElapsed(e => e + 1);
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isLoading, !!result]);

    // 3. SUBMIT: Updated to show result immediately below
    const doSubmit = useCallback(async () => {
        if (!question || result || isSubmitting) return;

        const payload: SubmitPayload = {
            timeSpent: elapsed,
            presentationId: question.presentationId ?? question.presentation_id ?? null,
        };
        const qType = question.questionType ?? 'mcq';

        if (qType === 'mcq') payload.selectedOption = selectedOption;
        else if (qType === 'msq') payload.selectedOptions = selectedOptions;
        else if (qType === 'matrix_match') payload.matrixPairs = matrixPairs;
        else payload.answerText = answerInput;

        setIsSubmitting(true);
        try {
            setShowHint(false);
            setShowSolution(false);
            const res = await submitOgcodeAnswerAction(question.id, payload);
            if (timerRef.current) clearInterval(timerRef.current);
            setResult(res); // This triggers the result UI
            toast.success(res.isCorrect ? "Brilliant! Correct Answer" : "Not quite right. Try again?");
            
            // Refresh user data if solved
            if (res.isCorrect && !res.already_solved) {
                onRefreshUser?.();
            }
        } catch {
            toast.error('Submission failed.');
        } finally {
            setIsSubmitting(false);
        }
    }, [question, result, isSubmitting, elapsed, selectedOption, selectedOptions, matrixPairs, answerInput]);

    const handleTryAgain = () => {
        setResult(null);
        setShowHint(false);
        setShowSolution(false);
        // Resume timer
        timerRef.current = setInterval(() => {
            setElapsed(e => e + 1);
        }, 1000);
    };

    useEffect(() => {
        if (question?.subject && setTimeMode) {
            setTimeMode('practice', question.subject);
            return () => setTimeMode('webpage');
        }
    }, [question?.subject, setTimeMode]);

    if (isLoading) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
    );
    if (!question) return null;

    // 1. SAFE NORMALIZATION: Handle both camelCase and snake_case from backend
    const apiQuestion = question as PracticeQuestionApi;
    const rawType = apiQuestion.question_type || apiQuestion.questionType;
    const qType: string = rawType?.toLowerCase() || 'mcq';
    
    // Safely get matrix data, handling both naming conventions and possible stringified JSON
    const mDataRaw = apiQuestion.matrixData || apiQuestion.matrix_data;
    let mData: PracticeQuestion['matrixData'] | null = null;
    if (mDataRaw) {
        try {
            mData = typeof mDataRaw === 'string' ? JSON.parse(mDataRaw) as PracticeQuestion['matrixData'] : mDataRaw;
        } catch (e) {
            console.error('Failed to parse matrix data:', e);
        }
    }
    
    const colA = mData?.column_a || [];
    const colB = mData?.column_b || [];
    
    // Normalize difficulty
    const diffKey = (question.difficulty || 'medium').toLowerCase();
    const diff = DIFFICULTY_CONFIG[diffKey as keyof typeof DIFFICULTY_CONFIG] || DIFFICULTY_CONFIG.medium;

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300">
            {/* Header */}
            <div className="relative h-14 sm:h-12 border-b border-border flex items-center px-3 sm:px-4 bg-background sticky top-0 z-50">
                <button onClick={onBack} className="p-2 neu-raised rounded-lg transition-all hover:-translate-y-0.5" aria-label="Back to questions">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Stats — pinned to the centre of the header */}
                <div id="tutorial-ogcode-stats" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-amber-500 font-mono bg-amber-500/5 px-2 py-1 rounded-md border border-amber-500/10">
                        <Trophy className="w-3.5 h-3.5" />
                        {user?.points || 0} <span className="hidden xs:inline">PTS</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 font-mono bg-white/5 px-2 py-1 rounded-md border border-white/5">
                        <Clock className="w-3.5 h-3.5" /> {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-background">
                <div className="max-w-3xl mx-auto px-4 sm:px-8 py-4 sm:py-5 space-y-5">
                    {/* Question navigation — top of content, always visible */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => goToQuestion(prevId)}
                            disabled={!prevId}
                            aria-label="Previous question"
                            title={navQueue?.label ? `Previous · ${navQueue.label}` : 'Previous question'}
                            className="neu-raised flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-foreground transition-all hover:-translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:translate-y-0"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Prev
                        </button>
                        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                            {total > 0 && index >= 0 ? `${index + 1} / ${total}` : `# ${questionId}`}
                        </span>
                        {nextId ? (
                            <button
                                onClick={() => goToQuestion(nextId)}
                                aria-label="Next question"
                                title={navQueue?.label ? `Next · ${navQueue.label}` : 'Next question'}
                                className="neu-raised flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-foreground transition-all hover:-translate-y-0.5"
                            >
                                Next
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <button
                                onClick={loadMoreQuestions}
                                disabled={isLoadingMore}
                                aria-label="Load more questions"
                                className="neu-raised flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-primary transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                            >
                                {isLoadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                {isLoadingMore ? 'Loading…' : 'Load More'}
                            </button>
                        )}
                    </div>

                    {/* Question Content */}
                    <div id="tutorial-ogcode-content" className="space-y-4">
                        <div className="flex items-center justify-end gap-2">
                            {/* Subject Ori avatar */}
                            {question.subject && SUBJECT_ORI_MAP[question.subject] && (
                                <img
                                    src={SUBJECT_ORI_MAP[question.subject]}
                                    alt={question.subject}
                                    draggable={false}
                                    className="w-8 h-8 object-contain select-none"
                                />
                            )}
                            <span className="text-[10px] font-bold text-primary px-2 py-1 bg-primary/10 rounded uppercase tracking-wider">
                                {question.subject}
                            </span>
                            <span className={`text-[10px] font-bold ${diff.color} px-2 py-1 ${diff.bg} rounded uppercase tracking-wider`}>
                                {diff.label}
                            </span>
                        </div>
                        <div className="text-xl sm:text-2xl font-serif leading-relaxed text-slate-900 dark:text-slate-100 select-text cursor-text">
                            {renderQuestionText(question.text, 'question-text')}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {safeTags.map((tag, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded text-slate-600 dark:text-slate-400">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Subtle Divider */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* Interaction and Results */}
                    <div id="tutorial-ogcode-input" className="space-y-4 pb-8">

                        {/* 1. INPUT SECTION */}
                        <div className="space-y-4">
                            {qType === 'mcq' && (question.options || []).map((opt, idx) => (
                                <button
                                    key={idx}
                                    disabled={!!result || isSubmitting}
                                    onClick={() => setSelectedOption(idx)}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all font-serif backdrop-blur-md
                                        ${selectedOption === idx ? 'border-primary bg-primary/10' : 'border-slate-200 dark:border-white/10 bg-white/40 dark:bg-white/[0.02]'}
                                        ${result?.isCorrect && result?.correctOption === idx ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : ''}
                                        ${result && !result.isCorrect && selectedOption === idx ? 'border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400' : ''}
                                    `}
                                >
                                    <span className="font-mono text-xs mr-3 opacity-50">({String.fromCharCode(65 + idx)})</span>
                                    <span className="select-text">{renderInlineSegments(String(opt), `mcq-option-${idx}`)}</span>
                                </button>
                            ))}

                            {qType === 'msq' && (question.options || []).map((opt, idx) => (
                                <button
                                    key={idx}
                                    disabled={!!result || isSubmitting}
                                    onClick={() => {
                                        setSelectedOptions(prev =>
                                            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                        );
                                    }}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all font-serif backdrop-blur-md
                                        ${selectedOptions.includes(idx) ? 'border-primary bg-primary/10' : 'border-slate-200 dark:border-white/10 bg-white/40 dark:bg-white/[0.02]'}
                                        ${result?.isCorrect && result?.correctOptions?.includes(idx) ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : ''}
                                        ${result && !result.isCorrect && selectedOptions.includes(idx) ? 'border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400' : ''}
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedOptions.includes(idx) ? 'bg-primary border-primary' : 'border-white/20'}`}>
                                            {selectedOptions.includes(idx) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                        <span className="font-mono text-xs opacity-50">({String.fromCharCode(65 + idx)})</span>
                                        <span className="select-text">{renderInlineSegments(String(opt), `msq-option-${idx}`)}</span>
                                    </div>
                                </button>
                            ))}

                            {qType === 'matrix_match' && mData && (
                                <div className="space-y-6">
                                    {/* Column B Reference (New) */}
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Column B Reference</h4>
                                            <button 
                                                onClick={() => setMatrixPairs([])}
                                                className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 px-2 py-1 bg-primary/5 hover:bg-primary/10 rounded-md border border-primary/20"
                                            >
                                                <X className="w-3 h-3" /> Clear Selections
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {(colB).map((term: string, idx: number) => (
                                                <div key={idx} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-2.5">
                                                    <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-xs text-slate-300 truncate">
                                                        {renderInlineSegments(String(term), `matrix-term-${idx}`)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {(colA).map((itemA: string, idxA: number) => (
                                            <div key={idxA} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4 hover:border-white/10 transition-colors shadow-sm">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <span className="w-7 h-7 rounded-lg bg-white/10 text-slate-400 flex items-center justify-center text-[12px] font-black shrink-0 border border-white/5 shadow-inner">
                                                            {String.fromCharCode(65 + idxA)}
                                                        </span>
                                                        <span className="text-[15px] font-bold text-slate-200 tracking-tight leading-relaxed">
                                                            {renderInlineSegments(String(itemA), `matrix-item-${idxA}`)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-3 pt-2">
                                                    {(colB).map((_itemB: string, idxB: number) => {
                                                        const isSelected = matrixPairs.some(p => p[0] === idxA && p[1] === idxB);
                                                        const resultWithSnakeCase = result as SubmitResultApi | null;
                                                        const resPairs = result?.correctPairs || resultWithSnakeCase?.correct_pairs;
                                                        const isCorrect = result?.isCorrect && resPairs?.some(p => p[0] === idxA && p[1] === idxB);

                                                        return (
                                                            <button
                                                                key={idxB}
                                                                disabled={!!result || isSubmitting}
                                                                onClick={() => {
                                                                    setMatrixPairs(prev => {
                                                                        const exists = prev.some(p => p[0] === idxA && p[1] === idxB);
                                                                        if (exists) return prev.filter(p => !(p[0] === idxA && p[1] === idxB));
                                                                        return [...prev, [idxA, idxB]];
                                                                    });
                                                                }}
                                                                className={`w-12 h-12 rounded-xl border text-[13px] font-black transition-all flex items-center justify-center shadow-sm backdrop-blur-sm
                                                                    ${isSelected ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white/40 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500'}
                                                                    ${result?.isCorrect && isCorrect ? 'bg-emerald-500 border-emerald-500 text-white' : ''}
                                                                    ${result && !result.isCorrect && isSelected ? 'bg-rose-500 border-rose-500 text-white animate-pulse' : ''}
                                                                    hover:scale-105 active:scale-95 group/btn
                                                                `}
                                                            >
                                                                <span className="group-hover/btn:scale-110 transition-transform">{idxB + 1}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(qType === 'numerical' || qType === 'subjective') && (
                                <div className="space-y-3">
                                    <input
                                        type={qType === 'numerical' ? "number" : "text"}
                                        disabled={!!result || isSubmitting}
                                        value={answerInput}
                                        onChange={(e) => setAnswerInput(e.target.value)}
                                        className="w-full bg-white/5 border-2 border-white/10 p-5 rounded-2xl text-2xl text-center font-mono focus:border-primary outline-none transition-all backdrop-blur-md"
                                        placeholder={qType === 'numerical' ? "Enter value..." : "Type answer..."}
                                    />
                                    {result && !result.isCorrect && result.correctAnswerText && (
                                        <p className="text-xs text-rose-400 text-center">Incorrect. The value you entered doesn&apos;t match the expected answer.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 2. SUBMIT BUTTON (Hidden after result) */}
                        {!result && (
                            <button
                                id="tutorial-ogcode-submit"
                                onClick={doSubmit}
                                disabled={isSubmitting || (
                                    qType === 'mcq' ? selectedOption === null :
                                        qType === 'msq' ? selectedOptions.length === 0 :
                                            qType === 'matrix_match' ? matrixPairs.length === 0 :
                                                !answerInput
                                )}
                                className="w-full py-4 bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] backdrop-blur-md"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                                Submit Answer
                            </button>
                        )}

                        {/* 3. RESULT SECTION (Appears immediately below after submit) */}
                        {result && (
                            <div className={`p-5 rounded-2xl border-2 animate-in fade-in slide-in-from-top-4 duration-300
                                ${result.isCorrect ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}
                            `}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-2 rounded-full ${result.isCorrect ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                                        {result.isCorrect ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <XCircle className="w-6 h-6 text-rose-500" />}
                                    </div>
                                    <div>
                                        <h3 className={`font-bold ${result.isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {result.isCorrect ? 'Correct Answer' : 'Incorrect Answer'}
                                        </h3>
                                        <p className="text-xs text-slate-500">Time spent: {Math.floor(elapsed / 60)}m {elapsed % 60}s</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
                                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-500">Result Score</p>
                                        <p className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                                            {result.resultScore ?? 0}
                                            <span className="ml-1 text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-500">/ {result.maxPoints ?? result.basePoints ?? 0}</span>
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-500">Points Earned</p>
                                        <p className={`text-base sm:text-lg font-black ${result.pointsAwarded ? 'text-amber-400' : 'text-slate-400'}`}>
                                            +{result.pointsAwarded ?? 0}
                                        </p>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-500">Speed Rating</p>
                                        <p className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">
                                            {result.speedBand ? SPEED_BAND_LABELS[result.speedBand] : 'Recorded'}
                                        </p>
                                        {typeof result.targetTimeSeconds === 'number' && (
                                            <p className="text-[9px] sm:text-[11px] text-slate-500">
                                                Target {Math.floor(result.targetTimeSeconds / 60)}m {result.targetTimeSeconds % 60}s
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {result.isCorrect ? (
                                    result.explanation && (
                                        <div className="pt-4 border-t border-white/5">
                                            <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <Trophy className="w-4 h-4" /> Solution
                                            </p>
                                            {renderFormattedExplanation(result.explanation)}
                                        </div>
                                    )
                                ) : (
                                    <div className="space-y-4 mt-2">
                                        {(question.hint || result.correctAnswerText || result.explanation) && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {question.hint && !showHint && (
                                                    <button 
                                                        onClick={() => setShowHint(true)}
                                                        className="w-full py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-amber-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all group"
                                                    >
                                                        <HelpCircle className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" /> Need a Hint?
                                                    </button>
                                                )}
                                                {(result.correctAnswerText || result.explanation) && !showSolution && (
                                                    <button
                                                        onClick={() => setShowSolution(true)}
                                                        className="w-full py-3 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-primary text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                                    >
                                                        <Trophy className="w-3.5 h-3.5" /> See Full Solution
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {showHint && question.hint && (
                                            <div className="pt-4 border-t border-white/5 animate-in fade-in zoom-in-95 duration-300">
                                                <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <HelpCircle className="w-3.5 h-3.5" /> Hint
                                                </p>
                                                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line font-serif italic">
                                                    {renderQuestionText(question.hint, 'hint-text')}
                                                </div>
                                            </div>
                                        )}

                                        {showSolution && (result.correctAnswerText || result.explanation) && (
                                            <div className="pt-4 border-t border-white/5 animate-in fade-in zoom-in-95 duration-300 space-y-3">
                                                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <Trophy className="w-3.5 h-3.5" /> Full Solution
                                                </p>
                                                {result.correctAnswerText && (
                                                    <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 backdrop-blur-sm">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Stored Answer</p>
                                                        <div className="text-sm leading-relaxed">
                                                            <FormattedMessage content={result.correctAnswerText} />
                                                        </div>
                                                    </div>
                                                )}
                                                {result.explanation && (
                                                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Reference Explanation</p>
                                                        {renderFormattedExplanation(result.explanation)}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-3 mt-6">
                                    {!result.isCorrect && (
                                        <button
                                            onClick={handleTryAgain}
                                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 border border-blue-400/20"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            Try Again
                                        </button>
                                    )}
                                    <button
                                        onClick={onBack}
                                        className={`py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold transition-colors ${result.isCorrect ? 'w-full' : 'flex-1'}`}
                                    >
                                        Return to Dashboard
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
