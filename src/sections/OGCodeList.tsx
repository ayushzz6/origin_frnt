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
    ChevronRight, Target, Shuffle, ArrowRight, X, Info, Gauge
} from 'lucide-react';
import { apiCall } from '@/lib/api';
import type { PracticeQuestion, PracticeQuestionPage, SubjectRank, User } from '@/types';
import { usePublishOriginAiPageContext } from '@/features/origin-ai/page-context-store';
import { saveOgcodeNavQueue } from '@/features/ogcode/nav-queue';
import { toast } from 'sonner';

// Characters that imply Markdown / LaTeX. If a string has none of them it is
// plain text and we can skip the (heavy) ReactMarkdown + KaTeX pipeline entirely
// — a large perf win when rendering a whole grid of question cards, and it also
// avoids Markdown mis-parsing a leading "10." as an <ol> (invalid inside <p>).
const MARKDOWN_HINT = /[$\\*_`~<>[\]#|]/;

function renderInlineSegments(value: string, _keyPrefix?: string) {
    const text = value || '';
    if (!MARKDOWN_HINT.test(text)) return text;
    return <FormattedMessage content={text} inline />;
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
    const [showScoreInfo, setShowScoreInfo] = useState(false);

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

    // Memoised so the filtered array keeps a stable identity between unrelated
    // re-renders — otherwise the page-context memo + nav-queue effect below would
    // re-run on every render (each keystroke), reflowing the whole card grid.
    const filteredQuestions = useMemo(() => questions.filter(q => {
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
    }), [questions, searchQuery, activeSubject, selectedChapters, activeDifficulty, activeStatus]);

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

    // Persist the current filtered ordering so the question workspace can offer
    // Previous / Next that respect whatever filter is applied here.
    const filteredIdsKey = filteredQuestions.map(q => q.id).join(',');
    useEffect(() => {
        const label = [
            activeSubject !== 'Subject' ? activeSubject : null,
            activeDifficulty !== 'All' ? activeDifficulty : null,
            activeStatus !== 'All' ? activeStatus : null,
            selectedChapters.length ? `${selectedChapters.length} chapter${selectedChapters.length > 1 ? 's' : ''}` : null,
            searchQuery.trim() ? `“${searchQuery.trim()}”` : null,
        ].filter(Boolean).join(' · ') || 'All questions';
        saveOgcodeNavQueue({ ids: filteredQuestions.map(q => String(q.id)), label });
        // filteredIdsKey captures order+membership; other deps feed the label.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredIdsKey, activeSubject, activeDifficulty, activeStatus, selectedChapters, searchQuery]);

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
        <div className="min-h-screen neu-surface text-foreground font-sans selection:bg-primary/30 pb-20 md:pb-16">
            <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 pt-6 space-y-5">

                {/* ── Header ── */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                    <motion.div
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45 }}
                        className="space-y-1.5"
                    >
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground leading-tight">
                                OG<span className="text-primary">CODE</span> Workspace
                            </h1>
                            <button
                                type="button"
                                onClick={() => setShowScoreInfo(true)}
                                aria-label="How is the OGCODE score calculated?"
                                title="How is the OGCODE score calculated?"
                                className="neu-raised flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-primary transition-colors mt-0.5"
                            >
                                <Info className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-sm text-muted-foreground max-w-xl">
                            Master complex concepts through structured practice, build your streak, and climb the national leaderboard.
                        </p>
                    </motion.div>

                    {/* AIR Badge & Stats Dropdown */}
                    <div ref={statsRef} className="relative self-start z-[220]">
                        <button
                            onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                            className={cn(
                                'neu-raised flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-300',
                                isStatsExpanded && 'bg-primary text-primary-foreground',
                            )}
                        >
                            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', isStatsExpanded ? 'bg-white/20' : 'bg-amber-500/10')}>
                                <Trophy className={cn('w-4.5 h-4.5', isStatsExpanded ? 'text-white' : 'text-amber-500')} />
                            </div>
                            <div className="text-left">
                                <div className="text-[9px] font-black uppercase tracking-wider opacity-60">National Rank</div>
                                <div className="text-lg font-black leading-none">AIR {myRank ? `#${myRank}` : '—'}</div>
                            </div>
                            <ChevronRight className={cn('w-4 h-4 ml-1 transition-transform duration-300', isStatsExpanded && 'rotate-90')} />
                        </button>

                        <AnimatePresence>
                            {isStatsExpanded && (
                                <motion.div
                                    initial={{ opacity: 0, y: 16, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute top-full left-0 sm:left-auto sm:right-0 mt-3 w-[min(calc(100vw-2rem),380px)] z-[230] space-y-3 pointer-events-auto"
                                >
                                    {/* Mastery Card */}
                                    <div className="neu-raised p-5">
                                        <h3 className="text-[10px] font-black text-primary tracking-[0.3em] uppercase mb-4 flex items-center gap-2.5">
                                            <div className="w-7 h-7 bg-primary/10 rounded-xl flex items-center justify-center">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                            </div>
                                            Mastery Analytics
                                        </h3>
                                        <div className="space-y-3">
                                            {[
                                                { label: 'Current Streak', val: `${streak}d`, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                                                { label: 'Solved Questions', val: solvedCount, icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10' },
                                                { label: 'Accuracy Rate', val: `${accuracy}%`, icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                                                { label: 'Prestige Points', val: user.points || 0, icon: Zap, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
                                            ].map((stat) => (
                                                <div key={stat.label} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', stat.bg, stat.color)}>
                                                            <stat.icon className="w-3.5 h-3.5" />
                                                        </div>
                                                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                                                    </div>
                                                    <span className="text-sm font-black text-foreground">{stat.val}</span>
                                                </div>
                                            ))}
                                            <div className="pt-3 mt-1 border-t border-border/40 space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Syllabus Coverage</span>
                                                    <span className="text-base font-black text-primary">{syllabusCoverage}%</span>
                                                </div>
                                                <div className="h-2 rounded-full overflow-hidden neu-inset">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${syllabusCoverage}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="h-full bg-primary rounded-full" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Arena Rankings Card */}
                                    <div className="neu-raised p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-[10px] font-black text-amber-500 tracking-[0.3em] uppercase flex items-center gap-2.5">
                                                <div className="w-7 h-7 bg-amber-500/10 rounded-xl flex items-center justify-center">
                                                    <Trophy className="w-3.5 h-3.5" />
                                                </div>
                                                Arena Rankings
                                            </h3>
                                            <div className="neu-inset rounded-xl p-1 flex">
                                                {(['daily', 'weekly'] as const).map((r) => (
                                                    <button
                                                        key={r}
                                                        type="button"
                                                        onClick={() => setTimeRange(r)}
                                                        className={cn(
                                                            'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                                                            timeRange === r ? 'neu-raised text-primary' : 'text-muted-foreground',
                                                        )}
                                                    >
                                                        {r}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            {statsLoading && subjectRanks.length === 0 ? (
                                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Loading rankings...</div>
                                            ) : subjectRanks.length > 0 ? (
                                                subjectRanks.map((rank, i) => (
                                                    <div key={i} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center bg-primary/10', SUBJECT_COLORS[rank.subject])}>
                                                                {SUBJECT_ICONS[rank.subject]}
                                                            </div>
                                                            <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">{rank.subject}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-black text-amber-500">#{rank.rankPosition || rank.rank}</div>
                                                            <div className="text-[8px] font-black text-muted-foreground uppercase">AIR</div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rankings will appear after your first attempts.</div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => { setIsStatsExpanded(false); onSelectQuestion('leaderboard'); }}
                                                className="w-full pt-3 mt-1 border-t border-border/40 text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-opacity hover:opacity-70"
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

                {/* ── Filters ── */}
                <div className="space-y-3">
                    {/* Subject + Chapter picker */}
                    <div id="filter-area" className="neu-inset rounded-2xl p-4 sm:p-5 relative z-[80]">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                            {/* Subject dropdown */}
                            <div className="space-y-1.5 w-full sm:w-auto">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Major Subject</label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        id="tutorial-ogcode-subject-filter"
                                        onClick={() => setOpenDropdown(openDropdown === 'subject' ? null : 'subject')}
                                        className={cn(
                                            'w-full sm:min-w-[200px] flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl transition-all neu-raised',
                                            activeSubject !== 'Subject' && 'ring-2 ring-primary/30',
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-primary">{SUBJECTS.find(s => s.name === activeSubject)?.icon}</span>
                                            <span className="text-[13px] font-bold text-foreground">{activeSubject}</span>
                                        </div>
                                        <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', openDropdown === 'subject' ? '-rotate-90' : 'rotate-90')} />
                                    </button>

                                    <AnimatePresence>
                                        {openDropdown === 'subject' && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 8 }}
                                                className="absolute top-full mt-2 left-0 w-full min-w-[200px] neu-raised rounded-xl z-[90] overflow-hidden pointer-events-auto"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                {SUBJECTS.map((sub, idx) => (
                                                    <button
                                                        type="button"
                                                        key={idx}
                                                        onClick={() => { handleSubjectChange(sub.name); setOpenDropdown(null); }}
                                                        className={cn(
                                                            'w-full flex items-center gap-3 px-4 py-3 text-[13px] transition-colors hover:bg-primary/5',
                                                            activeSubject === sub.name ? 'text-primary font-bold' : 'text-muted-foreground',
                                                        )}
                                                    >
                                                        <span className={cn(activeSubject === sub.name ? 'text-primary' : 'text-muted-foreground/60')}>{sub.icon}</span>
                                                        {sub.name}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Chapter chips */}
                            {activeSubject !== 'Subject' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex-1 space-y-1.5 min-w-[260px]"
                                >
                                    <div className="flex items-center justify-between ml-1">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Chapters</label>
                                            <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[8px] font-black uppercase tracking-tighter">Multi-select</span>
                                        </div>
                                        <button onClick={handleClearChapters} className="text-[9px] font-black uppercase text-primary disabled:opacity-30 transition-opacity" disabled={selectedChapters.length === 0}>
                                            Clear All
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 max-h-[130px] overflow-y-auto pr-1">
                                        {chaptersLoading ? (
                                            <span className="text-[11px] text-muted-foreground italic py-2">Loading chapters…</span>
                                        ) : availableChapters.length > 0 ? (
                                            availableChapters.map((chapter) => {
                                                const active = selectedChapters.includes(chapter);
                                                return (
                                                    <button
                                                        key={chapter}
                                                        onClick={() => handleToggleChapter(chapter)}
                                                        className={cn(
                                                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all',
                                                            active ? 'neu-inset text-primary' : 'neu-raised text-muted-foreground hover:text-foreground',
                                                        )}
                                                    >
                                                        <div className={cn('w-2.5 h-2.5 rounded-sm border-2 flex items-center justify-center', active ? 'bg-primary border-primary' : 'border-muted-foreground/40')}>
                                                            {active && <div className="w-1 h-1 bg-white rounded-[1px]" />}
                                                        </div>
                                                        {chapter}
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground italic py-2">No chapters found.</span>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {selectedChapters.length > 0 && (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-end pb-0.5">
                                    <button
                                        onClick={() => { toast.success(`Filters applied for ${selectedChapters.length} chapters`); }}
                                        className="neu-btn px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2 group"
                                    >
                                        Proceed to Arena
                                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* Search + secondary filters */}
                    <div id="secondary-filter-area" className="flex flex-wrap items-center gap-3 relative z-[40]">
                        {/* Search */}
                        <div className="flex-1 min-w-[260px] neu-raised rounded-2xl flex items-center gap-3 px-4 h-11">
                            <Search className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                            <input
                                type="text"
                                placeholder="Search by title, tags or concepts…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="flex-1 h-full bg-transparent text-[13px] font-medium text-foreground placeholder:text-muted-foreground/50 outline-none"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="p-1 rounded-full hover:bg-primary/10 transition-colors">
                                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                            )}
                        </div>

                        {/* Difficulty */}
                        <div className="relative">
                            <button
                                id="tutorial-ogcode-difficulty-filter"
                                onClick={() => setOpenDropdown(openDropdown === 'difficulty' ? null : 'difficulty')}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all',
                                    activeDifficulty !== 'All' ? 'neu-inset text-primary' : 'neu-raised text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {activeDifficulty === 'All' ? 'Difficulty' : activeDifficulty}
                                <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', openDropdown === 'difficulty' ? '-rotate-90' : 'rotate-90')} />
                            </button>
                            {openDropdown === 'difficulty' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    className="absolute top-full mt-2 left-0 w-40 neu-raised rounded-xl z-50 overflow-hidden"
                                    onClick={e => e.stopPropagation()}
                                >
                                    {['All', 'Easy', 'Medium', 'Hard', 'Insane'].map(diff => (
                                        <button key={diff} onClick={() => { handleDifficultyChange(diff); setOpenDropdown(null); }}
                                            className={cn('w-full text-left px-4 py-2.5 text-[12px] transition-colors hover:bg-primary/5', activeDifficulty === diff ? 'text-primary font-bold' : 'text-muted-foreground')}
                                        >{diff}</button>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        {/* Status */}
                        <div className="relative">
                            <button
                                onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all',
                                    activeStatus !== 'All' ? 'neu-inset text-primary' : 'neu-raised text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {activeStatus === 'All' ? 'Status' : activeStatus}
                                <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', openDropdown === 'status' ? '-rotate-90' : 'rotate-90')} />
                            </button>
                            {openDropdown === 'status' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    className="absolute top-full mt-2 left-0 w-40 neu-raised rounded-xl z-50 overflow-hidden"
                                    onClick={e => e.stopPropagation()}
                                >
                                    {['All', 'Solved', 'Unsolved'].map(stat => (
                                        <button key={stat} onClick={() => { handleStatusChange(stat); setOpenDropdown(null); }}
                                            className={cn('w-full text-left px-4 py-2.5 text-[12px] transition-colors hover:bg-primary/5', activeStatus === stat ? 'text-primary font-bold' : 'text-muted-foreground')}
                                        >{stat}</button>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        {/* Random pick */}
                        <button
                            onClick={() => { if (filteredQuestions.length > 0) onSelectQuestion(filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)].id); }}
                            className="neu-btn flex items-center gap-2 px-4 py-2 text-[12px] font-black text-primary"
                        >
                            <Shuffle className="w-3.5 h-3.5" /> Pick One
                        </button>
                    </div>
                </div>

                {/* ── Question Tile Grid ── */}
                <div className="pb-4">
                    {showQuestionsSpinner ? (
                        <div className="py-20 text-center">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                    ) : filteredQuestions.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                            {filteredQuestions.map((q, idx) => {
                                const conf = DIFFICULTY_CONFIG[q.difficulty?.toLowerCase()] || DIFFICULTY_CONFIG.easy;
                                const solved = q.status === 'solved' || q.isSolved;
                                return (
                                    <div
                                        key={q.id}
                                        onClick={() => handleQuestionClick(q.id)}
                                        className="neu-raised neu-pressable cursor-pointer group flex flex-col gap-3 p-4 sm:p-5 min-h-[148px]"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-muted-foreground">#{idx + 1}</span>
                                                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border', conf.bg, conf.darkBg, conf.textColor, conf.darkText, conf.border, conf.darkBorder)}>
                                                    {conf.icon}{conf.label}
                                                </span>
                                            </div>
                                            {solved && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                                        </div>

                                        <div className="flex-1 text-[13px] font-bold text-foreground leading-snug line-clamp-3 group-hover:text-primary transition-colors duration-150">
                                            {renderInlineSegments(String(q.title || q.text), `tile-${q.id}`)}
                                        </div>

                                        <div className="flex items-end justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-black text-foreground/80 truncate">{q.chapter || 'Foundations'}</p>
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider truncate">{q.concept || 'JEE Advanced'}</p>
                                            </div>
                                            <button className="flex-shrink-0 inline-flex items-center gap-1 neu-btn px-3 py-1.5 text-[10px] font-black text-primary uppercase tracking-wider whitespace-nowrap">
                                                Attempt <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-20 text-center text-muted-foreground text-sm">No questions found matching your criteria.</div>
                    )}

                    <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            {questionsLoading && questions.length > 0 ? 'Updating question list…' : questionSummaryLabel}
                        </div>
                        {hasMoreQuestions && (
                            <button
                                type="button"
                                onClick={handleLoadMore}
                                disabled={questionsLoading}
                                className="neu-btn inline-flex items-center justify-center gap-2 px-5 py-2 text-[11px] font-black uppercase tracking-wider text-primary disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {questionsLoading ? 'Loading…' : `Load ${QUESTION_PAGE_SIZE} More`}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── How the OGCODE score works ── */}
            <AnimatePresence>
                {showScoreInfo && (
                    <motion.div
                        className="fixed inset-0 z-[300] flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowScoreInfo(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 18 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 18 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                            className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar neu-surface rounded-2xl border border-border/40 p-6 shadow-2xl"
                        >
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Gauge className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black tracking-tight text-foreground">How your OGCODE score works</h2>
                                        <p className="text-xs text-muted-foreground">Every question you attempt is scored on <span className="font-bold text-foreground">accuracy × speed</span>.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowScoreInfo(false)}
                                    aria-label="Close"
                                    className="neu-raised flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="space-y-4 text-sm text-foreground/90">
                                <div>
                                    <p className="font-bold text-foreground mb-2 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> 1 · Base points by difficulty</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { label: 'Easy', pts: 10, cls: 'text-emerald-500' },
                                            { label: 'Medium', pts: 25, cls: 'text-amber-500' },
                                            { label: 'Hard', pts: 50, cls: 'text-rose-500' },
                                            { label: 'Insane', pts: 100, cls: 'text-indigo-500' },
                                        ].map((d) => (
                                            <div key={d.label} className="neu-inset rounded-xl px-2 py-2.5 text-center">
                                                <div className={cn('text-lg font-black leading-none', d.cls)}>{d.pts}</div>
                                                <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{d.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="font-bold text-foreground mb-2 flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> 2 · Speed multiplier (0.55× – 1.35×)</p>
                                    <p className="text-xs text-muted-foreground mb-2">
                                        Each difficulty has a target time (Easy 45s · Medium 90s · Hard 180s · Insane 300s). Beat it and you earn a bonus; take much longer and the multiplier drops.
                                    </p>
                                    <div className="space-y-1.5">
                                        {[
                                            { band: 'Blazing', desc: '≤ half the target time', mult: '1.35×', cls: 'text-emerald-500' },
                                            { band: 'Fast', desc: 'comfortably under target', mult: '~1.1–1.35×', cls: 'text-emerald-400' },
                                            { band: 'Steady', desc: 'around the target time', mult: '~0.9–1.0×', cls: 'text-amber-500' },
                                            { band: 'Deliberate', desc: 'noticeably over target', mult: '~0.7–0.9×', cls: 'text-orange-500' },
                                            { band: 'Slow', desc: 'over 1.75× the target', mult: '0.55×', cls: 'text-rose-500' },
                                        ].map((s) => (
                                            <div key={s.band} className="flex items-center justify-between gap-3 rounded-lg neu-inset px-3 py-1.5">
                                                <div className="flex items-baseline gap-2">
                                                    <span className={cn('text-xs font-black uppercase tracking-wide', s.cls)}>{s.band}</span>
                                                    <span className="text-[11px] text-muted-foreground">{s.desc}</span>
                                                </div>
                                                <span className="text-xs font-bold text-foreground tabular-nums">{s.mult}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="font-bold text-foreground mb-2 flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> 3 · Your score</p>
                                    <div className="rounded-xl neu-inset px-4 py-3 space-y-2">
                                        <p className="text-center text-sm font-bold text-foreground">
                                            Score = round(<span className="text-primary">base points</span> × <span className="text-primary">speed multiplier</span>) + 5
                                        </p>
                                        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                                            <li>A <span className="font-bold text-foreground">correct</span> answer earns the score above (minimum 5).</li>
                                            <li>A <span className="font-bold text-foreground">wrong</span> answer scores 0 — but you can keep retrying.</li>
                                            <li>Points count toward your total &amp; national rank only the <span className="font-bold text-foreground">first time</span> you solve a question correctly.</li>
                                        </ul>
                                    </div>
                                </div>

                                <p className="text-[11px] text-muted-foreground/80 italic">
                                    Tip: solving harder questions quickly is the fastest way to climb the leaderboard.
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
