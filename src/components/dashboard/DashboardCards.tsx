'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Clock, Target, CheckCircle2, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiCall } from '@/lib/api';
import { useEffect } from 'react';
import { useLayout } from '@/context/LayoutContext';
import { useHydratedNow } from '@/hooks/useHydratedNow';
import { cn } from '@/lib/utils';

import type { User, Task } from '@/types';

export interface DashboardChallengePreview {
    id: string | number;
    concept?: string | null;
    subject?: string | null;
    isSolved?: boolean;
}

interface ChallengeCardProps {
    user?: User;
    onStartChallenge?: (questionId: string) => void;
    initialChallenge?: DashboardChallengePreview | null;
}

export function ChallengeCard({ user, onStartChallenge, initialChallenge }: ChallengeCardProps) {
    const { availableWidth } = useLayout();
    const isMobile = availableWidth < 640;

    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [challenge, setChallenge] = useState<DashboardChallengePreview | null>(initialChallenge ?? null);
    const [isLoadingChallenge, setIsLoadingChallenge] = useState(!initialChallenge);

    useEffect(() => {
        if (initialChallenge) {
            return;
        }

        const fetchChallenge = async () => {
            setIsLoadingChallenge(true);
            try {
                const data = await apiCall('/assessments/ogcode/challenge/') as DashboardChallengePreview;
                setChallenge(data);
            } catch (error) {
                console.error("Failed to fetch challenge of the day:", error);
            } finally {
                setIsLoadingChallenge(false);
            }
        };
        fetchChallenge();
    }, [initialChallenge, user?.id]);

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const startDay = currentMonth.getDay();

    const solvedSet = useMemo(() => {
        const set = new Set<string>();
        user?.contributionData?.forEach(item => {
            if (item.count > 0) {
                const dateStr = typeof item.date === 'string' ? item.date.split('T')[0] : '';
                if (dateStr) set.add(dateStr);
            }
        });
        return set;
    }, [user?.contributionData]);

    const isSolved = (day: number) => {
        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        return solvedSet.has(`${year}-${month}-${dayStr}`);
    };

    const isToday = (day: number) => {
        return today.getDate() === day &&
            today.getMonth() === currentMonth.getMonth() &&
            today.getFullYear() === currentMonth.getFullYear();
    };

    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

    return (
        <Card className="premium-card bg-card/50 backdrop-blur-xl relative flex flex-col group min-h-[350px] sm:min-h-[400px] border-border/50">
            {/* Header: Month Navigation */}
            <div className={cn("flex items-center justify-between pt-5 pb-2", isMobile ? "px-3" : "px-5")}>
                <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        Day {today.getDate()}
                        <span className="text-[10px] text-muted-foreground font-medium tracking-tight whitespace-nowrap uppercase">Daily Challenge</span>
                    </h3>
                </div>
                <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-0.5 border border-border/50">
                    <button onClick={prevMonth} className="p-1 hover:bg-background rounded-md text-muted-foreground transition-colors">
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground w-12 text-center">
                        {currentMonth.toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                    <button onClick={nextMonth} className="p-1 hover:bg-background rounded-md text-muted-foreground transition-colors">
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <CardContent className="px-3 sm:px-5 pb-3 sm:pb-5 flex-1 flex flex-col justify-between overflow-visible">

                {/* Calendar Grid */}
                <div className="mb-2">
                    <div className="grid grid-cols-7 gap-1 mb-1.5">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <div key={i} className="text-center text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: startDay }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-7" />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const solved = isSolved(day);
                            const current = isToday(day);

                            return (
                                <div key={day} className="h-7 flex items-center justify-center relative group/day cursor-default">
                                    <div className={`
                                        w-6 h-6 flex items-center justify-center rounded-full text-[10px] transition-all
                                        ${solved ? "ring-2 ring-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted-foreground font-medium hover:bg-muted"}
                                        ${current && !solved ? "text-primary font-black bg-primary/10 ring-1 ring-primary/50" : ""}
                                    `}>
                                        {solved ? <CheckCircle2 className="w-3.5 h-3.5" /> : day}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom Section: Start Challenge */}
                <div className="mt-auto bg-gradient-to-r from-primary/10 to-transparent rounded-xl p-3 border border-primary/20 flex items-center justify-between">
                    <div className="flex flex-col">
                        <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <Trophy className="w-3 h-3" />
                            Challenge of the Day
                        </p>
                        <p className="text-[11px] font-bold text-foreground">
                            {isLoadingChallenge ? (
                                <span className="opacity-50">Loading...</span>
                            ) : challenge ? (
                                <>Solve <span className="text-primary font-bold">{challenge.concept || challenge.subject}</span></>
                            ) : (
                                <span className="text-muted-foreground/50">No challenge today</span>
                            )}
                        </p>
                    </div>
                    <Button 
                        size="sm" 
                        disabled={isLoadingChallenge || !challenge || challenge.isSolved}
                        onClick={() => challenge && onStartChallenge?.(challenge.id.toString())}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 text-[11px] font-bold px-4 h-8 transition-transform hover:scale-105 rounded-lg disabled:opacity-50"
                    >
                        {challenge?.isSolved ? 'Solved' : 'Start Now'}
                    </Button>
                </div>

            </CardContent>
        </Card>
    );
}

export function PastActivitiesCard({ user }: { user: User }) {
    const { availableWidth } = useLayout();
    const isMobile = availableWidth < 640;

    const analytics = user.timeAnalytics || [];
    const today = analytics[analytics.length - 1] || { practiceTime: 0, webpageTime: 0, pomodoroTime: 0 };

    const toHM = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const types = [
        {
            label: 'Webpage',
            icon: '🌐',
            secs: today.webpageTime || 0,
            color: 'bg-indigo-600',
            textColor: 'text-indigo-600',
        },
        {
            label: 'Practice',
            icon: '📝',
            secs: today.practiceTime || 0,
            color: 'bg-emerald-600',
            textColor: 'text-emerald-600',
        },
        {
            label: 'Pomodoro',
            icon: '🍅',
            secs: today.pomodoroTime || 0,
            color: 'bg-amber-600',
            textColor: 'text-amber-600',
        },
    ];

    const totalSecs = types.reduce((a, t) => a + t.secs, 0);

    return (
        <Card className="premium-card relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

            <CardContent className={cn("relative z-10 flex flex-col gap-4 sm:gap-5", isMobile ? "p-3" : "p-6")}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn("rounded-xl bg-primary/10 flex items-center justify-center text-primary", isMobile ? "w-8 h-8" : "w-10 h-10")}>
                            <Clock className={isMobile ? "w-4 h-4" : "w-5 h-5"} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-[#334155]">Time Spent</h3>
                            {!isMobile && <p className="text-[10px] text-[#64748B] font-medium">Today — {toHM(totalSecs)} total</p>}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={cn("font-black text-[#334155]", isMobile ? "text-lg" : "text-xl")}>{toHM(totalSecs)}</p>
                        <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-bold">This session</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {types.map((t) => {
                        const pct = totalSecs > 0 ? (t.secs / totalSecs) * 100 : 0;
                        return (
                            <div key={t.label} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-[#64748B] flex items-center gap-1.5">
                                        <span>{t.icon}</span> {t.label}
                                    </span>
                                    <span className={`text-[11px] font-black ${t.textColor}`}>{toHM(t.secs)}</span>
                                </div>
                                <div className="w-full h-2 bg-primary/10 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                        className={`h-full ${t.color} rounded-full`}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

export function PlacesToConcentrateCard({ user }: { user?: User }) {
    const { availableWidth } = useLayout();
    const isMobile = availableWidth < 640;

    return (
        <Card className="premium-card min-h-48 h-auto relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />

            <CardContent className={cn("relative z-10 flex flex-col h-full", isMobile ? "p-4" : "p-6")}>
                <div className="flex items-start gap-4 mb-4">
                    <div className={cn("rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500", isMobile ? "w-10 h-10" : "w-12 h-12")}>
                        <Target className={isMobile ? "w-5 h-5" : "w-6 h-6"} />
                    </div>
                    <div>
                        <h3 className={cn("font-bold text-foreground", isMobile ? "text-sm" : "text-base")}>Focus Areas</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Based on your recent tests</p>
                    </div>
                </div>


                <div className={cn("flex-1 flex items-center justify-around", isMobile ? "px-0" : "px-4")}>
                    {/* Dynamic Progress Circles */}
                    {(user?.subjects?.length ? user.subjects : ['Physics', 'Chemistry', 'Mathematics']).slice(0, 3).map((subject, idx) => {
                        const colors = ['text-red-400', 'text-amber-400', 'text-emerald-400', 'text-blue-400'];
                        const progress = [45, 62, 88, 70][idx % 4];
                        return (
                            <div key={subject} className="flex flex-col items-center gap-2 group/item">
                                <div className={cn("relative flex items-center justify-center", isMobile ? "w-12 h-12" : "w-14 h-14")}>
                                    <svg className="w-full h-full -rotate-90">
                                        <circle cx={isMobile ? "24" : "28"} cy={isMobile ? "24" : "28"} r={isMobile ? "20" : "24"} stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                                        <circle cx={isMobile ? "24" : "28"} cy={isMobile ? "24" : "28"} r={isMobile ? "20" : "24"} stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={isMobile ? "126" : "150"} strokeDashoffset={(isMobile ? 126 : 150) - ((isMobile ? 126 : 150) * (progress / 100))} className={`${colors[idx % 4]} transition-all duration-1000`} strokeLinecap="round" />
                                    </svg>
                                    <span className={cn("absolute font-bold text-black dark:text-slate-200", isMobile ? "text-[10px]" : "text-xs")}>{progress}%</span>
                                </div>
                                <span className="text-[10px] font-semibold text-black/60 dark:text-slate-400 tracking-wide uppercase truncate max-w-[60px]">{subject}</span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

// initialTodos removed and moved to App.tsx

interface TodoListCardProps {
    tasks: Task[];
    onAddTask: (text: string, due: string) => void;
    onToggleTask: (id: string) => void;
    onRemoveTask: (id: string) => void;
    onViewAll: () => void;
}

const TASK_DUE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
});
const ONE_DAY_MS = 86_400_000;

function getDefaultDueDate(now: number) {
    const d = new Date(now + ONE_DAY_MS);
    return d.toISOString().slice(0, 16);
}

export function TodoListCard({ tasks, onAddTask, onToggleTask, onRemoveTask, onViewAll }: TodoListCardProps) {
    const [newTaskText, setNewTaskText] = useState('');
    const hydratedNow = useHydratedNow();
    const [lastMutationNow, setLastMutationNow] = useState<number | null>(null);
    const [newTaskDue, setNewTaskDue] = useState('');
    const now = lastMutationNow ?? hydratedNow;
    const displayedNewTaskDue = newTaskDue || (now === null ? '' : getDefaultDueDate(now));

    const handleAdd = () => {
        if (!newTaskText.trim()) return;
        const current = Date.now();
        const dueInput = newTaskDue || displayedNewTaskDue;
        const dueContent = dueInput ? new Date(dueInput).toISOString() : new Date(current + ONE_DAY_MS).toISOString();
        onAddTask(newTaskText.trim(), dueContent);
        setNewTaskText('');
        setLastMutationNow(current);
        setNewTaskDue(getDefaultDueDate(current));
    };

    const isOverdue = (dateString: string) => {
        if (now === null) return false;
        if (!dateString) return false;
        const dueDate = new Date(dateString);
        if (isNaN(dueDate.getTime())) return false;
        return dueDate.getTime() < now;
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'No date';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';
        return TASK_DUE_FORMATTER.format(date);
    };

    return (
        <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 bg-card backdrop-blur-xl h-full relative overflow-hidden flex flex-col ring-1 ring-border">
            {/* Soft decorative background */}
            <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-gradient-to-bl from-primary/5 to-transparent dark:from-primary/10 pointer-events-none" />

            <CardContent className="relative z-10 p-4 sm:p-6 md:p-8 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4 sm:mb-8">
                    <h3 className="text-base sm:text-xl font-black text-foreground flex items-center gap-2 sm:gap-3">
                        <div className="w-1 h-4 sm:w-1.5 sm:h-6 bg-primary rounded-full shadow-sm shadow-primary/20" />
                        Tasks & Goals
                    </h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={onViewAll}
                      className="h-8 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all rounded-lg"
                    >
                        View All
                    </Button>
                </div>

                {/* Add Task Input - Optimized for mobile */}
                <div className="mb-4 sm:mb-10 space-y-3 sm:space-y-4 max-w-4xl mx-auto w-full">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                        <input
                            type="text"
                            placeholder="Add a task..."
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            className="flex-1 bg-primary/5 dark:bg-slate-800/50 border border-primary/10 dark:border-slate-700 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-base text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium shadow-sm"
                        />
                        <Button
                            onClick={handleAdd}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl sm:rounded-2xl px-4 sm:px-6 h-10 sm:h-12 shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold"
                        >
                            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span>Add Task</span>
                        </Button>
                    </div>
                    <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-4 px-1">
                        <span className="text-[8px] sm:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Deadline:</span>
                        <input
                            type="datetime-local"
                            value={displayedNewTaskDue}
                            onChange={(e) => setNewTaskDue(e.target.value)}
                            className="bg-slate-50/80 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50 rounded-lg px-2 py-0.5 sm:py-1 text-[8px] sm:text-[10px] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer"
                        />
                    </div>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[360px] min-h-0 pr-2 custom-scrollbar">
                    {tasks.map((todo) => {
                        const overdue = !todo.completed && isOverdue(todo.due);
                        return (
                            <div key={todo.id} className={`group flex items-start gap-3 p-2.5 rounded-xl transition-all animate-in fade-in slide-in-from-top-1 duration-300 ${overdue ? 'bg-primary/5 border border-primary/20' : 'hover:bg-primary/5 dark:hover:bg-slate-800/50'}`}>
                                <button
                                    onClick={() => onToggleTask(todo.id)}
                                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${todo.completed
                                        ? 'bg-indigo-500 border-indigo-500 text-white'
                                        : overdue
                                            ? 'border-primary/40 dark:border-primary/50 text-transparent hover:text-primary'
                                            : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-500 text-transparent hover:text-indigo-500'
                                        }`}>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium transition-colors truncate ${todo.completed
                                        ? 'text-black/30 dark:text-slate-600 line-through decoration-black/30'
                                        : overdue
                                            ? 'text-primary dark:text-primary/80'
                                            : 'text-black dark:text-slate-200'
                                        }`}>
                                        {todo.text}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 border-0 font-bold uppercase tracking-wider ${todo.completed
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                            : overdue
                                                ? 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary/80'
                                                : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                                            }`}>
                                            {overdue ? 'MISSED • ' : ''}{formatDate(todo.due)}
                                        </Badge>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onRemoveTask(todo.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-primary transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
