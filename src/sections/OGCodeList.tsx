'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import {
    CheckCircle2, Search,
    Trophy, Zap, Flame, Brain, Circle,
    TrendingUp, Atom, Beaker, Calculator, Leaf,
    ChevronRight, Target, Shuffle, ArrowRight, X
} from 'lucide-react';
import { apiCall } from '@/lib/api';
import type { PracticeQuestion, PracticeQuestionPage, SubjectRank, User } from '@/types';
import { usePublishOriginAiPageContext } from '@/features/origin-ai/page-context-store';
import { toast } from 'sonner';

function renderInlineSegments(value: string, keyPrefix: string) {
    return <FormattedMessage content={value || ''} inline />;
}


interface OGCodeListProps {
    onSelectQuestion: (questionId: string) => void;
    user: User;
    initialQuestionPage: PracticeQuestionPage | null;
    initialSubjectRanks: SubjectRank[] | null;
    initialUserStats: UserStats | null;
    initialChapters: string[] | null;
}

const SUBJECTS = [
    { name: 'Subject', icon: <Brain className="w-4 h-4" /> },
    { name: 'Physics', icon: <Atom className="w-4 h-4" /> },
    { name: 'Chemistry', icon: <Beaker className="w-4 h-4" /> },
    { name: 'Mathematics', icon: <Calculator className="w-4 h-4" /> },
    { name: 'Biology', icon: <Leaf className="w-4 h-4" /> },
];

const DIFFICULTY_CONFIG: Record<string, { label: string; textColor: string; darkText: string; bg: string; darkBg: string; border: string; darkBorder: string; icon: React.ReactNode }> = {
    easy: { label: 'Easy', textColor: 'text-emerald-600', darkText: 'dark:text-emerald-400', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-500/5', border: 'border-emerald-100', darkBorder: 'dark:border-emerald-500/20', icon: <Circle className="w-2.5 h-2.5" /> },
    medium: { label: 'Medium', textColor: 'text-amber-600', darkText: 'dark:text-amber-400', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-500/5', border: 'border-amber-100', darkBorder: 'dark:border-amber-500/20', icon: <Zap className="w-2.5 h-2.5" /> },
    hard: { label: 'Hard', textColor: 'text-rose-600', darkText: 'dark:text-rose-400', bg: 'bg-rose-50', darkBg: 'dark:bg-rose-500/5', border: 'border-rose-100', darkBorder: 'dark:border-rose-500/20', icon: <Flame className="w-2.5 h-2.5" /> },
    insane: { label: 'Insane', textColor: 'text-indigo-600', darkText: 'dark:text-indigo-400', bg: 'bg-indigo-50', darkBg: 'dark:bg-indigo-500/5', border: 'border-indigo-100', darkBorder: 'dark:border-indigo-500/20', icon: <Brain className="w-2.5 h-2.5" /> },
};

const SUBJECT_ICONS: Record<string, React.ReactNode> = {
    Physics: <Atom className="w-3.5 h-3.5" />,
    Chemistry: <Beaker className="w-3.5 h-3.5" />,
    Mathematics: <Calculator className="w-3.5 h-3.5" />,
    Biology: <Leaf className="w-3.5 h-3.5" />,
};

const SUBJECT_COLORS: Record<string, string> = {
    Physics: 'text-primary',
    Chemistry: 'text-sky-500',
    Mathematics: 'text-indigo-500',
    Biology: 'text-emerald-500',
};

const ORIGIN_AI_VISIBLE_QUESTION_LIMIT = 40;
const QUESTION_PAGE_SIZE = 60;

function normalizeTags(tags: string | string[] | null | undefined): string[] {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags;
    if (typeof tags === 'string') {
        try {
            const parsed = JSON.parse(tags);
            if (Array.isArray(parsed)) return parsed;
        } catch { /* ignored */ }
        return tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    return [];
}

function normalizeSubject(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

export interface UserStats {
    rank: number | null;
    accuracy: number;
    solvedCount: number;
    syllabusCoverage: number;
    streak: number;
    totalAttempts: number;
}

function normalizeQuestionPage(data: unknown): PracticeQuestionPage {
    if (!data || typeof data !== 'object') {
        return { items: [], total: 0, limit: QUESTION_PAGE_SIZE, offset: 0, hasMore: false };
    }

    const payload = data as Partial<PracticeQuestionPage>;
    return {
        items: Array.isArray(payload.items) ? payload.items : [],
        total: Number(payload.total ?? 0),
        limit: Number(payload.limit ?? QUESTION_PAGE_SIZE) || QUESTION_PAGE_SIZE,
        offset: Number(payload.offset ?? 0) || 0,
        hasMore: Boolean(payload.hasMore),
    };
}

function dedupeQuestions(questions: PracticeQuestion[]): PracticeQuestion[] {
    const seen = new Set<string>();
    return questions.filter((question) => {
        if (seen.has(question.id)) return false;
        seen.add(question.id);
        return true;
    });
}

function deriveChapterOptions(subject: string, questions: PracticeQuestion[]): string[] {
    if (subject === 'Subject') {
        return [];
    }

    return Array.from(
        new Set(
            questions
                .filter((question) => normalizeSubject(question.subject) === normalizeSubject(subject))
                .map((question) => question.chapter || 'Foundations'),
        ),
    ).sort();
}

function mapStatusFilter(status: string): 'solved' | 'unsolved' | null {
    if (status === 'Solved') {
        return 'solved';
    }
    if (status === 'Unsolved') {
        return 'unsolved';
    }
    return null;
}

function parseSubjectFilter(value: string | null): string {
    switch ((value ?? '').trim().toLowerCase()) {
        case 'physics':
            return 'Physics';
        case 'chemistry':
            return 'Chemistry';
        case 'mathematics':
            return 'Mathematics';
        case 'biology':
            return 'Biology';
        default:
            return 'Subject';
    }
}

function parseDifficultyFilter(value: string | null): string {
    switch ((value ?? '').trim().toLowerCase()) {
        case 'easy':
            return 'Easy';
        case 'medium':
            return 'Medium';
        case 'hard':
            return 'Hard';
        case 'insane':
            return 'Insane';
        default:
            return 'All';
    }
}

function parseStatusFilter(value: string | null): string {
    switch ((value ?? '').trim().toLowerCase()) {
        case 'solved':
            return 'Solved';
        case 'unsolved':
            return 'Unsolved';
        default:
            return 'All';
    }
}

function sameStringArray(left: string[], right: string[]) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buildOgcodeUrl(filters: {
    subject: string;
    difficulty: string;
    status: string;
    chapters: string[];
    search: string;
}) {
    const params = new URLSearchParams();

    if (filters.subject !== 'Subject') params.set('subject', filters.subject);
    if (filters.difficulty !== 'All') params.set('difficulty', filters.difficulty.toLowerCase());
    if (filters.status !== 'All') {
        const mappedStatus = mapStatusFilter(filters.status);
        if (mappedStatus) {
            params.set('status', mappedStatus);
        }
    }
    // Use repeated ?chapters=… params instead of a comma-joined list.
    // Chapter names contain commas (e.g. "Acids, Bases, and Volumetric Analysis"),
    // so a CSV round-trip corrupts them and fights the state.
    for (const chapter of filters.chapters) {
        params.append('chapters', chapter);
    }

    const normalizedSearch = filters.search.trim();
    if (normalizedSearch) params.set('search', normalizedSearch);

    const query = params.toString();
    return query ? `/ogcode?${query}` : '/ogcode';
}

export default function OGCodeList({
    onSelectQuestion,
    user,
    initialQuestionPage,
    initialSubjectRanks,
    initialUserStats,
    initialChapters,
}: OGCodeListProps) {
    const searchParams = useSearchParams();

    // Initialize state from URL params
    const initialSubject = parseSubjectFilter(searchParams.get('subject'));
    const initialDifficulty = parseDifficultyFilter(searchParams.get('difficulty'));
    const initialStatus = parseStatusFilter(searchParams.get('status'));
    const initialSearch = searchParams.get('search') || '';
    const initialSelectedChapters = searchParams.getAll('chapters').filter(Boolean);
    const prefetchedQuestionPage = initialQuestionPage ? normalizeQuestionPage(initialQuestionPage) : null;

    const [questions, setQuestions] = useState<PracticeQuestion[]>(prefetchedQuestionPage?.items ?? []);
    const [totalQuestions, setTotalQuestions] = useState(prefetchedQuestionPage?.total ?? 0);
    const [hasMoreQuestions, setHasMoreQuestions] = useState(prefetchedQuestionPage?.hasMore ?? false);
    const [nextOffset, setNextOffset] = useState((prefetchedQuestionPage?.offset ?? 0) + (prefetchedQuestionPage?.items.length ?? 0));
    const [subjectRanks, setSubjectRanks] = useState<SubjectRank[]>(initialSubjectRanks ?? []);
    const [questionsLoading, setQuestionsLoading] = useState(!prefetchedQuestionPage);
    const [statsLoading, setStatsLoading] = useState(!(initialSubjectRanks && initialUserStats));
    const [chaptersLoading, setChaptersLoading] = useState(false);
    const [userStats, setUserStats] = useState<UserStats | null>(initialUserStats);
    const [searchQuery, setSearchQuery] = useState(initialSearch);
    const [activeSubject, setActiveSubject] = useState(initialSubject);
    const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    
    const [activeDifficulty, setActiveDifficulty] = useState(initialDifficulty);
    const [activeStatus, setActiveStatus] = useState(initialStatus);
    const [selectedChapters, setSelectedChapters] = useState<string[]>(initialSelectedChapters);
    const [availableChapters, setAvailableChapters] = useState<string[]>(
        initialChapters ?? deriveChapterOptions(initialSubject, prefetchedQuestionPage?.items ?? []),
    );
    const [openDropdown, setOpenDropdown] = useState<'difficulty' | 'status' | 'subject' | null>(null);
    const [isStatsExpanded, setIsStatsExpanded] = useState(false);
    
    const handleQuestionClick = useCallback((questionId: string) => {
        if (typeof window !== 'undefined') {
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0) {
                return;
            }
        }
        onSelectQuestion(questionId);
    }, [onSelectQuestion]);

    const skipInitialQuestionFetch = useRef(Boolean(prefetchedQuestionPage));
    const skipInitialStatsFetch = useRef(Boolean(initialSubjectRanks && initialUserStats));
    const skipInitialChapterFetch = useRef(initialChapters !== null && initialSubject !== 'Subject');
    // Next 16 patches history.pushState to update useSearchParams inside a
    // startTransition. Our filter setters are urgent, so there's a window
    // where state is new but useSearchParams still reflects the old URL.
    // The URL→state sync effect below sees that mismatch and reverts the
    // user's click, then the transition lands and flips it back — an
    // oscillation. This ref marks self-initiated URL pushes so the effect
    // skips them, while still syncing on genuine external changes
    // (browser back/forward, <Link> navigations).
    const selfInitiatedUrlChange = useRef(false);
    const lastSyncedSearch = useRef(initialSearch);
    
    const urlSubject = parseSubjectFilter(searchParams.get('subject'));
    const urlDifficulty = parseDifficultyFilter(searchParams.get('difficulty'));
    const urlStatus = parseStatusFilter(searchParams.get('status'));
    const urlSearch = searchParams.get('search') || '';
    const urlSelectedChapters = searchParams.getAll('chapters').filter(Boolean);

    const syncUrlParams = useCallback((
        updates: Partial<{ subject: string; difficulty: string; status: string; chapters: string[]; search: string }>,
        mode: 'push' | 'replace' = 'push',
    ) => {
        if (typeof window === 'undefined') {
            return;
        }

        const url = buildOgcodeUrl({
            subject: updates.subject ?? activeSubject,
            difficulty: updates.difficulty ?? activeDifficulty,
            status: updates.status ?? activeStatus,
            chapters: updates.chapters ?? selectedChapters,
            search: updates.search ?? searchQuery,
        });
        
        if (updates.search !== undefined) {
            lastSyncedSearch.current = updates.search;
        }
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (currentUrl === url) {
            return;
        }

        selfInitiatedUrlChange.current = true;
        window.history[mode === 'replace' ? 'replaceState' : 'pushState'](null, '', url);
    }, [activeDifficulty, activeStatus, activeSubject, searchQuery, selectedChapters]);

    useEffect(() => {
        if (selfInitiatedUrlChange.current) {
            selfInitiatedUrlChange.current = false;
            return;
        }
        if (activeSubject !== urlSubject) {
            setActiveSubject(urlSubject);
            setAvailableChapters([]);
        }
        if (activeDifficulty !== urlDifficulty) {
            setActiveDifficulty(urlDifficulty);
        }
        if (activeStatus !== urlStatus) {
            setActiveStatus(urlStatus);
        }
        if (searchQuery !== urlSearch && lastSyncedSearch.current !== urlSearch) {
            setSearchQuery(urlSearch);
            lastSyncedSearch.current = urlSearch;
        }
        if (!sameStringArray(selectedChapters, urlSelectedChapters)) {
            setSelectedChapters(urlSelectedChapters);
        }
    }, [
        activeDifficulty,
        activeStatus,
        activeSubject,
        searchQuery,
        selectedChapters,
        urlDifficulty,
        urlSearch,
        urlSelectedChapters,
        urlStatus,
        urlSubject,
    ]);

    // Handle filter changes
    const handleSubjectChange = (subject: string) => {
        setActiveSubject(subject);
        setSelectedChapters([]);
        setAvailableChapters([]);
        syncUrlParams({ subject, chapters: [] }, 'push');
    };

    const handleDifficultyChange = (difficulty: string) => {
        setActiveDifficulty(difficulty);
        syncUrlParams({ difficulty }, 'push');
    };

    const handleStatusChange = (status: string) => {
        setActiveStatus(status);
        syncUrlParams({ status }, 'push');
    };

    const handleToggleChapter = (chapter: string) => {
        const next = selectedChapters.includes(chapter) 
            ? selectedChapters.filter(c => c !== chapter) 
            : [...selectedChapters, chapter];
        setSelectedChapters(next);
        syncUrlParams({ chapters: next }, 'push');
    };

    const handleClearChapters = () => {
        setSelectedChapters([]);
        syncUrlParams({ chapters: [] }, 'push');
    };
    // Refs for click-outside detection
    const statsRef = useRef<HTMLDivElement>(null);

    // Combined click-outside detection for stats and dropdowns
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            // Stats dropdown
            if (statsRef.current && !statsRef.current.contains(target)) {
                setIsStatsExpanded(false);
            }
            // General filter dropdowns
            const filterArea = document.getElementById('filter-area');
            const secondaryFilterArea = document.getElementById('secondary-filter-area');
            const isInsideFilters = (filterArea && filterArea.contains(target)) || 
                                   (secondaryFilterArea && secondaryFilterArea.contains(target));
            
            if (!isInsideFilters) {
                setOpenDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const buildQuestionQueryString = useCallback((offset: number) => {
        const params = new URLSearchParams();
        params.set('limit', String(QUESTION_PAGE_SIZE));
        params.set('offset', String(offset));

        if (activeSubject !== 'Subject') params.set('subject', activeSubject);
        if (activeDifficulty !== 'All') params.set('difficulty', activeDifficulty.toLowerCase());
        if (activeStatus !== 'All') {
            const mappedStatus = mapStatusFilter(activeStatus);
            if (mappedStatus) params.set('status', mappedStatus);
        }
        for (const chapter of selectedChapters) {
            params.append('chapters', chapter);
        }

        const normalizedSearch = searchQuery.trim();
        if (normalizedSearch) params.set('search', normalizedSearch);

        return params.toString();
    }, [activeDifficulty, activeStatus, activeSubject, searchQuery, selectedChapters]);

    const fetchQuestionPage = useCallback(async ({ offset = 0, append = false }: { offset?: number; append?: boolean } = {}) => {
        setQuestionsLoading(true);
        try {
            const data = await apiCall(`/assessments/ogcode/questions/?${buildQuestionQueryString(offset)}`);
            const page = normalizeQuestionPage(data);

            setQuestions((current) => append ? dedupeQuestions([...current, ...page.items]) : page.items);
            setTotalQuestions(page.total);
            setHasMoreQuestions(page.hasMore);
            setNextOffset(page.offset + page.items.length);
        } catch (error) {
            console.error('Failed to fetch OGCode data:', error);
            toast.error('Failed to load questions');
        } finally {
            setQuestionsLoading(false);
        }
    }, [buildQuestionQueryString]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            if (skipInitialQuestionFetch.current) {
                skipInitialQuestionFetch.current = false;
                return;
            }
            // Clear current questions if it's a fresh search to show spinner
            if (searchQuery.trim()) {
                setQuestions([]);
            }
            void fetchQuestionPage();
        }, searchQuery.trim() ? 300 : 0);

        return () => window.clearTimeout(timeout);
    }, [fetchQuestionPage, searchQuery]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            syncUrlParams({ search: searchQuery }, 'replace');
        }, searchQuery.trim() ? 300 : 0);

        return () => window.clearTimeout(timeout);
    }, [searchQuery, syncUrlParams]);

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const [rankData, statsData] = await Promise.all([
                apiCall(`/assessments/ogcode/leaderboard/subjects/?time_range=${timeRange}`),
                apiCall('/assessments/ogcode/user-stats/'),
            ]);
            setSubjectRanks(Array.isArray(rankData) ? rankData : []);
            setUserStats(statsData as UserStats);
        } catch (error) {
            console.error('Failed to fetch OGCode stats:', error);
        } finally {
            setStatsLoading(false);
        }
    }, [timeRange]);

    useEffect(() => {
        if (skipInitialStatsFetch.current) {
            skipInitialStatsFetch.current = false;
            return;
        }
        void fetchStats();
    }, [fetchStats]);

    const fetchChapters = useCallback(async () => {
        if (activeSubject === 'Subject') {
            setAvailableChapters([]);
            return;
        }

        setChaptersLoading(true);
        try {
            const data = await apiCall(`/assessments/ogcode/chapters/?subject=${encodeURIComponent(activeSubject)}`);
            setAvailableChapters(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch OGCode chapters:', error);
            setAvailableChapters([]);
        } finally {
            setChaptersLoading(false);
        }
    }, [activeSubject]);

    useEffect(() => {
        if (skipInitialChapterFetch.current) {
            skipInitialChapterFetch.current = false;
            return;
        }
        void fetchChapters();
    }, [fetchChapters]);

    const handleLoadMore = () => {
        if (!hasMoreQuestions || questionsLoading) {
            return;
        }
        void fetchQuestionPage({ offset: nextOffset, append: true });
    };

    const filteredQuestions = questions.filter(q => {
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch = !query || 
            (q.text || '').toLowerCase().includes(query) ||
            (q.title || '').toLowerCase().includes(query) ||
            (q.chapter || '').toLowerCase().includes(query) ||
            (q.concept || '').toLowerCase().includes(query) ||
            (q.subject || '').toLowerCase().includes(query) ||
            normalizeTags(q.tags).some(t => t.toLowerCase().includes(query));
        
        const matchesSubject =
            activeSubject === 'Subject' ||
            normalizeSubject(q.subject) === normalizeSubject(activeSubject);
        
        const matchesChapter = 
            selectedChapters.length === 0 || 
            selectedChapters.includes(q.chapter || 'Foundations');
        
        const qDifficulty = q.difficulty?.toLowerCase();
        const matchesDifficulty = activeDifficulty === 'All' || qDifficulty === activeDifficulty.toLowerCase();
        
        const isSolved = q.status === 'solved' || q.isSolved;
        const matchesStatus = activeStatus === 'All' || (activeStatus === 'Solved' ? isSolved : !isSolved);
            
        return matchesSearch && matchesSubject && matchesChapter && matchesDifficulty && matchesStatus;
    });

    const originAiPageContext = useMemo(() => ({
        pathname: '/ogcode',
        pageKind: 'ogcode_index' as const,
        searchQuery: searchQuery.trim() || null,
        activeSubject: activeSubject === 'Subject' ? null : activeSubject,
        activeDifficulty: activeDifficulty === 'All' ? null : activeDifficulty,
        activeStatus: activeStatus === 'All' ? null : activeStatus,
        selectedChapters,
        totalVisibleQuestions: filteredQuestions.length,
        visibleQuestions: filteredQuestions.slice(0, ORIGIN_AI_VISIBLE_QUESTION_LIMIT).map((question, index) => ({
            id: question.id,
            number: index + 1,
            title: question.title || question.text,
            chapter: question.chapter || 'Foundations',
            concept: question.concept || null,
            difficulty: question.difficulty || null,
            subject: question.subject || null,
            tags: normalizeTags(question.tags),
            isSolved: question.status === 'solved' || question.isSolved,
        })),
    }), [activeDifficulty, activeStatus, activeSubject, filteredQuestions, searchQuery, selectedChapters]);

    usePublishOriginAiPageContext(originAiPageContext);

    const solvedCount = userStats?.solvedCount ?? questions.filter(q => q.status === 'solved' || q.isSolved).length;
    const myRank = userStats?.rank;
    const accuracy = userStats?.accuracy ?? 0;
    const syllabusCoverage = userStats?.syllabusCoverage ?? 0;
    const streak = userStats?.streak ?? user.streak ?? 0;
    const showQuestionsSpinner = questionsLoading && questions.length === 0;
    const questionSummaryLabel = totalQuestions > 0
        ? `Showing ${Math.min(filteredQuestions.length, totalQuestions)} of ${totalQuestions} questions`
        : 'No questions available yet.';

    return (
        <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-slate-100 font-sans selection:bg-primary/30 px-4 sm:px-6 lg:px-8 pb-16 transition-colors duration-500">
            {/* Professional Background */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-slate-50/20 dark:bg-transparent" />

            <div className="max-w-7xl mx-auto relative z-10 pt-6">
                <div className="space-y-6">
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="space-y-3"
                        >
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                                OG<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60 dark:from-primary dark:to-primary/60">CODE</span> WORKSPACE
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-light max-w-xl text-sm sm:text-base">
                                Master complex concepts through structured practice, build your streak, and climb the national leaderboard.
                            </p>
                        </motion.div>

                        {/* AIR Badge & Stats Dropdown */}
                        <div ref={statsRef} className="relative self-start z-[220]">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                                className={cn(
                                    "flex items-center gap-3 px-5 py-3 rounded-xl border transition-all duration-300 shadow-lg",
                                    isStatsExpanded 
                                        ? "bg-primary border-primary text-primary-foreground" 
                                        : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                                )}
                            >
                                <div className={cn("p-1.5 rounded-lg", isStatsExpanded ? "bg-white/20" : "bg-amber-100 dark:bg-amber-500/20")}>
                                    <Trophy className={cn("w-4 h-4", isStatsExpanded ? "text-white" : "text-amber-500")} />
                                </div>
                                <div className="text-left">
                                    <div className="text-[9px] font-black uppercase tracking-tighter opacity-60">National Rank</div>
                                    <div className="text-lg font-black leading-none">AIR {myRank ? `#${myRank}` : '—'}</div>
                                </div>
                                <ChevronRight className={cn("w-4 h-4 ml-2 transition-transform duration-300", isStatsExpanded ? "rotate-90" : "")} />
                            </motion.button>

                            {/* Stats Dropdown Card */}
                            <AnimatePresence>
                                {isStatsExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                        className="absolute top-full left-0 sm:left-auto sm:right-0 mt-4 w-[min(calc(100vw-2rem),380px)] z-[230] space-y-4 pointer-events-auto"
                                    >
                                        {/* Mastery Index Card */}
                                        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xl">
                                            <h3 className="text-[11px] font-black text-primary dark:text-primary tracking-[0.3em] uppercase mb-4 flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-xl">
                                                    <TrendingUp className="w-4 h-4" />
                                                </div>
                                                Mastery Analytics
                                            </h3>
                                            <div className="space-y-3">
                                                {[
                                                    { label: 'Current Streak', val: `${streak}d`, icon: Flame, color: 'text-orange-500' },
                                                    { label: 'Solved Questions', val: solvedCount, icon: CheckCircle2, color: 'text-primary' },
                                                    { label: 'Accuracy Rate', val: `${accuracy}%`, icon: Target, color: 'text-emerald-500' },
                                                    { label: 'Prestige Points', val: user.points || 0, icon: Zap, color: 'text-indigo-500' },
                                                ].map((stat, idx) => (
                                                    <div key={idx} className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("p-2 rounded-lg bg-slate-100 dark:bg-white/5", stat.color)}>
                                                                <stat.icon className="w-4 h-4" />
                                                            </div>
                                                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</span>
                                                        </div>
                                                        <span className="text-sm font-black text-slate-900 dark:text-white">{stat.val}</span>
                                                    </div>
                                                ))}
                                                <div className="pt-4 mt-2 border-t border-slate-200/50 dark:border-white/5 space-y-2">
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Syllabus Coverage</span>
                                                        <span className="text-base font-black text-primary dark:text-primary">{syllabusCoverage}%</span>
                                                    </div>
                                                <div className="relative h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${syllabusCoverage}%` }} className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
                                                </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Arena Rankings Card */}
                                        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xl">
                                            <div className="flex items-center justify-between mb-6">
                                                <h3 className="text-[11px] font-black text-amber-600 dark:text-amber-400 tracking-[0.3em] uppercase flex items-center gap-3">
                                                    <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-xl">
                                                        <Trophy className="w-4 h-4" />
                                                    </div>
                                                    Arena Rankings
                                                </h3>
                                                <div className="flex bg-slate-100 dark:bg-black/40 p-1 rounded-xl">
                                                    {(['daily', 'weekly'] as const).map((r) => (
                                                        <button
                                                            key={r}
                                                            type="button"
                                                            onClick={() => setTimeRange(r)}
                                                            className={cn(
                                                                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer", 
                                                                timeRange === r 
                                                                    ? "bg-primary text-white shadow-lg" 
                                                                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                                                            )}
                                                        >
                                                            {r}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                {statsLoading && subjectRanks.length === 0 ? (
                                                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                        Loading rankings...
                                                    </div>
                                                ) : subjectRanks.length > 0 ? (
                                                    subjectRanks.map((rank, i) => (
                                                        <div key={i} className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn("p-2 rounded-lg bg-slate-100 dark:bg-white/5", SUBJECT_COLORS[rank.subject]?.split(' ')[0])}>
                                                                    {SUBJECT_ICONS[rank.subject]}
                                                                </div>
                                                                <div className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">{rank.subject}</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-sm font-black text-amber-500">#{rank.rankPosition || rank.rank}</div>
                                                                <div className="text-[8px] font-black text-slate-400 uppercase">AIR</div>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                        Rankings will appear after your first attempts.
                                                    </div>
                                                )}
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setIsStatsExpanded(false);
                                                        onSelectQuestion('leaderboard');
                                                    }}
                                                    className="w-full pt-4 mt-2 border-t border-slate-200/50 dark:border-white/5 text-[10px] font-black text-primary hover:text-primary uppercase tracking-[0.2em] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                                                >
                                                    Global Leaderboard <ArrowRight className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Filter & Table Area */}
                    <div className="space-y-6">
                        {/* Enhanced Subject & Chapter Filter */}
                        <div id="filter-area" className="space-y-4 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 backdrop-blur-sm relative z-[80]">
                            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                                <div className="space-y-1.5 w-full sm:w-auto">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 ml-1">Major Subject</label>
                                    <div className="relative">
                                        <button 
                                            type="button"
                                            id="tutorial-ogcode-subject-filter"
                                            onClick={() => setOpenDropdown(openDropdown === 'subject' ? null : 'subject')}
                                            className={cn(
                                                "w-full sm:min-w-[200px] flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border bg-white dark:bg-zinc-900 transition-all shadow-sm",
                                                activeSubject !== 'Subject' ? "border-primary/50 ring-1 ring-primary/20" : "border-slate-200 dark:border-white/10"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-primary">{SUBJECTS.find(s => s.name === activeSubject)?.icon}</span>
                                                <span className="text-[13px] font-bold text-slate-800 dark:text-white">{activeSubject}</span>
                                            </div>
                                            <ChevronRight className={cn("w-4 h-4 transition-transform", openDropdown === 'subject' ? "-rotate-90" : "rotate-90")} />
                                        </button>
                                        
                                        <AnimatePresence>
                                            {openDropdown === 'subject' && (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 10 }} 
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    className="absolute top-full mt-2 left-0 w-full min-w-[200px] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-[90] overflow-hidden pointer-events-auto backdrop-blur-none"
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    {SUBJECTS.map((sub, idx) => (
                                                        <button
                                                            type="button"
                                                            key={idx}
                                                            onClick={() => {
                                                                handleSubjectChange(sub.name);
                                                                setOpenDropdown(null);
                                                            }}
                                                            className={cn(
                                                                "w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] transition-colors hover:bg-slate-50 dark:hover:bg-white/5",
                                                                activeSubject === sub.name ? "text-primary font-bold bg-primary/5" : "text-slate-600 dark:text-slate-300"
                                                            )}
                                                        >
                                                            <span className={cn(activeSubject === sub.name ? "text-primary" : "text-slate-400")}>{sub.icon}</span>
                                                            {sub.name}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {activeSubject !== 'Subject' && (
                                    <motion.div 
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: 'auto' }}
                                        className="flex-1 space-y-1.5 min-w-[300px]"
                                    >
                                        <div className="flex items-center justify-between ml-1">
                                            <div className="flex items-center gap-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Target Chapters</label>
                                                <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[8px] font-black uppercase tracking-tighter">Multi-select</span>
                                            </div>
                                            <button 
                                                onClick={handleClearChapters}
                                                className="text-[9px] font-black uppercase text-primary hover:text-primary transition-colors"
                                                disabled={selectedChapters.length === 0}
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-[140px] sm:max-h-[120px] overflow-y-auto pr-2 custom-scrollbar p-1">
                                            {chaptersLoading ? (
                                                <div className="text-[11px] font-medium text-slate-400 italic py-2">Loading chapters...</div>
                                            ) : availableChapters.length > 0 ? (
                                                availableChapters.map((chapter) => (
                                                    <button
                                                        key={chapter}
                                                        onClick={() => handleToggleChapter(chapter)}
                                                        className={cn(
                                                            "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all",
                                                            selectedChapters.includes(chapter)
                                                                ? "bg-primary border-primary text-white shadow-md shadow-primary/20"
                                                                : "bg-white dark:bg-zinc-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:border-primary/30"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-3 h-3 rounded-sm border flex items-center justify-center transition-colors",
                                                            selectedChapters.includes(chapter) ? "bg-white border-white" : "border-slate-300 dark:border-zinc-600"
                                                        )}>
                                                            {selectedChapters.includes(chapter) && <div className="w-1.5 h-1.5 bg-primary rounded-[1px]" />}
                                                        </div>
                                                        {chapter}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="text-[11px] font-medium text-slate-400 italic py-2">No chapters found for this subject.</div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                {selectedChapters.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex items-end pb-1"
                                    >
                                        <button 
                                            onClick={() => {
                                                const tableEl = document.querySelector('table');
                                                tableEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                toast.success(`Filters applied for ${selectedChapters.length} chapters`);
                                            }}
                                            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center gap-2 group"
                                        >
                                            Proceed to Arena
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                        </div>

                        <div id="secondary-filter-area" className="flex flex-wrap items-center gap-3 py-2 relative z-[40]">
                            <div className="flex-1 min-w-[280px] relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by title, tags or concepts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2.5 bg-slate-100/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 rounded-xl text-[13px] font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all shadow-sm"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors"
                                    >
                                        <X className="w-3 h-3 text-slate-400" />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <button 
                                        id="tutorial-ogcode-difficulty-filter"
                                        onClick={() => setOpenDropdown(openDropdown === 'difficulty' ? null : 'difficulty')} 
                                        className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border border-transparent transition-all", activeDifficulty !== 'All' ? "bg-primary/10 text-primary border-primary/20" : "bg-slate-100/50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10")}>
                                        {activeDifficulty === 'All' ? 'Difficulty' : activeDifficulty} 
                                        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", openDropdown === 'difficulty' ? "-rotate-90" : "rotate-90")} />
                                    </button>
                                    {openDropdown === 'difficulty' && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-full mt-2 left-0 w-40 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                            {['All', 'Easy', 'Medium', 'Hard', 'Insane'].map((diff) => (
                                                <button key={diff} onClick={() => { handleDifficultyChange(diff); setOpenDropdown(null); }} className={cn("w-full text-left px-4 py-2.5 text-[13px] transition-colors hover:bg-slate-50 dark:hover:bg-white/5", activeDifficulty === diff ? "text-primary font-bold bg-primary/5" : "text-slate-600 dark:text-slate-400")}>{diff}</button>
                                            ))}
                                        </motion.div>
                                    )}
                                </div>
                                <div className="relative">
                                    <button onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border border-transparent transition-all", activeStatus !== 'All' ? "bg-primary/10 text-primary border-primary/20" : "bg-slate-100/50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10")}>
                                        {activeStatus === 'All' ? 'Status' : activeStatus} 
                                        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", openDropdown === 'status' ? "-rotate-90" : "rotate-90")} />
                                    </button>
                                    {openDropdown === 'status' && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-full mt-2 left-0 w-40 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                            {['All', 'Solved', 'Unsolved'].map((stat) => (
                                                <button key={stat} onClick={() => { handleStatusChange(stat); setOpenDropdown(null); }} className={cn("w-full text-left px-4 py-2.5 text-[13px] transition-colors hover:bg-slate-50 dark:hover:bg-white/5", activeStatus === stat ? "text-primary font-bold bg-primary/5" : "text-slate-600 dark:text-slate-400")}>{stat}</button>
                                            ))}
                                        </motion.div>
                                    )}
                                </div>
                                <button onClick={() => { if (filteredQuestions.length > 0) onSelectQuestion(filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)].id); }} className="flex items-center gap-2 px-4 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-[13px] font-black transition-all border border-primary/30"><Shuffle className="w-3.5 h-3.5" /> Pick One</button>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
                            {/* Table view for Desktop */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/50 dark:bg-white/[0.02]">
                                        <tr className="border-b border-slate-200 dark:border-white/5 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Title</th>
                                            <th className="px-6 py-4">Chapter & Concept</th>
                                            <th className="px-6 py-4">Difficulty</th>
                                            <th className="px-6 py-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                <tbody className="text-sm">
                                    {showQuestionsSpinner ? (
                                        <tr><td colSpan={5} className="py-20 text-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                                    ) : filteredQuestions.length > 0 ? (
                                        filteredQuestions.map((q, idx) => {
                                            const conf = DIFFICULTY_CONFIG[q.difficulty?.toLowerCase()] || DIFFICULTY_CONFIG.easy;
                                            return (
                                                <tr key={q.id} onClick={() => handleQuestionClick(q.id)} className={cn("group cursor-pointer transition-colors border-b last:border-0 border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.03]")}>
                                                    <td className="px-6 py-4">{(q.status === 'solved' || q.isSolved) ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <div className="w-5 h-1 bg-slate-300 dark:bg-slate-700/50 rounded-full" />}</td>
                                                    <td className="px-6 py-4 font-black text-[14px] text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">
                                                        <span className="mr-1">{idx + 1}.</span>
                                                        {renderInlineSegments(String(q.title || q.text), `ogcode-row-${q.id}`)}
                                                    </td>
                                                    <td className="px-6 py-4"><div className="space-y-0.5"><div className="text-[12px] font-black text-slate-700 dark:text-slate-300">{q.chapter || 'Foundations'}</div><div className="text-[10px] font-bold text-slate-500/80 uppercase tracking-wider">{q.concept || 'JEE Advanced'}</div></div></td>
                                                    <td className={cn("px-6 py-4 font-black text-[13px]", conf.darkText)}>{conf.label}</td>
                                                    <td className="px-6 py-4 text-right"><button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary hover:text-white text-primary text-[11px] font-black uppercase tracking-wider transition-all group/btn shadow-sm">Attempt Now <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" /></button></td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr><td colSpan={5} className="py-20 text-center text-slate-500 text-sm">No questions found matching your criteria.</td></tr>
                                    )}
                                </tbody>
                            </table>
                            </div>

                            {/* Card view for Mobile */}
                            <div className="md:hidden divide-y divide-slate-200 dark:divide-white/5">
                                {showQuestionsSpinner ? (
                                    <div className="py-20 text-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
                                ) : filteredQuestions.length > 0 ? (
                                    filteredQuestions.map((q, idx) => {
                                        const conf = DIFFICULTY_CONFIG[q.difficulty?.toLowerCase()] || DIFFICULTY_CONFIG.easy;
                                        return (
                                            <div 
                                                key={q.id} 
                                                onClick={() => handleQuestionClick(q.id)}
                                                className="p-4 active:bg-slate-50 dark:active:bg-white/5 transition-colors space-y-3"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            {(q.status === 'solved' || q.isSolved) && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                                                            <span className="text-[10px] font-bold text-slate-400">{idx + 1}.</span>
                                                            <span className={cn("text-[10px] font-black uppercase tracking-wider", conf.darkText)}>
                                                                {conf.label}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2">
                                                            {renderInlineSegments(String(q.title || q.text), `ogcode-mobile-${q.id}`)}
                                                        </h4>
                                                    </div>
                                                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                        <ChevronRight className="w-4 h-4" />
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between gap-4 pt-1">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                                                            {q.chapter || 'Foundations'}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-500/80 uppercase tracking-tighter">
                                                            {q.concept || 'JEE Advanced'}
                                                        </span>
                                                    </div>
                                                    <button className="px-3 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm">
                                                        Attempt
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="py-20 text-center text-slate-500 text-sm">No questions found matching your criteria.</div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-white/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    {questionsLoading && questions.length > 0 ? 'Updating question list...' : questionSummaryLabel}
                                </div>
                                {hasMoreQuestions ? (
                                    <button
                                        type="button"
                                        onClick={handleLoadMore}
                                        disabled={questionsLoading}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-primary transition-all hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {questionsLoading ? 'Loading...' : `Load ${QUESTION_PAGE_SIZE} More`}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Overlay removed in favor of id-based click-outside */}
            <style dangerouslySetInnerHTML={{ __html: `.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }` }} />
        </div>
    );
}
