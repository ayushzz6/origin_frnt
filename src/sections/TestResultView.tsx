'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';

const OriMascot = dynamic(() => import('@/features/mascot/Ori2D'), { ssr: false });
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronLeft,
  Clock,
  Target,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  XCircle,
  Sparkles,
  FileText,
  BookOpen
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import { DegradedBanner } from '@/components/DegradedBanner';
import { apiCall } from '@/lib/api';
import { buildSubjectTimeBreakdown } from '@/lib/tests/time-stats';
import type { ReviewEntry, TestResult } from '@/types';

interface TestResultViewProps {
  result: TestResult;
  history?: TestResult[];
  onBackToDashboard: () => void;
  onViewDPP: () => void;
  onRetakeTest: () => void;
  showSummary?: boolean;
}

export default function TestResultView({ 
  result: initialResult,
  history = [],
  onBackToDashboard, 
  onViewDPP,
  onRetakeTest,
  showSummary = true
}: TestResultViewProps) {
  const [result, setResult] = useState<TestResult>(initialResult);
  const [selectedSubject, setSelectedSubject] = useState<'overall' | string>('overall');
  const [selectedReviewTab, setSelectedReviewTab] = useState<'analysis' | 'mistakes' | 'correct' | 'recommendations'>('analysis');
  const [selectedReviewEntry, setSelectedReviewEntry] = useState(0);
  const reviewSectionRef = useRef<HTMLDivElement>(null);
  const analysisStatus = result.analysisStatus ?? result.analysis_status ?? 'complete';

  useEffect(() => {
    setResult(initialResult);
  }, [initialResult]);

  useEffect(() => {
    if (analysisStatus !== 'pending' || !result.id) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const next = await apiCall(`/assessments/results/${result.id}/analysis/`);
        if (!cancelled) {
          setResult(next);
        }
      } catch {
        // Keep the locally scored pending result visible until a later poll succeeds.
      }
    };

    const interval = window.setInterval(poll, 3000);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [analysisStatus, result.id]);

  const subjects = useMemo(() => {
    if (!result || !result.subjectStats) return [];
    return Object.keys(result.subjectStats);
  }, [result]);

  const reviewEntries = useMemo<ReviewEntry[]>(() => {
    if (result.aiAnalysis?.reviewEntries?.length) {
      return result.aiAnalysis.reviewEntries;
    }

    return (result.aiAnalysis?.mistakes ?? []).map((entry) => ({
      ...entry,
      status: 'incorrect' as const,
    }));
  }, [result.aiAnalysis?.mistakes, result.aiAnalysis?.reviewEntries]);

  const mistakeEntries = useMemo(
    () => reviewEntries.filter((entry) => entry.status === 'incorrect'),
    [reviewEntries],
  );

  const correctEntries = useMemo(
    () => reviewEntries.filter((entry) => entry.status === 'correct'),
    [reviewEntries],
  );

  const activeReviewEntries = selectedReviewTab === 'correct' ? correctEntries : mistakeEntries;
  const selectedReviewItem = activeReviewEntries[selectedReviewEntry] ?? null;

  const handleViewSolution = () => {
    const nextTab =
      mistakeEntries.length > 0
        ? 'mistakes'
        : correctEntries.length > 0
          ? 'correct'
          : 'analysis';

    setSelectedReviewTab(nextTab);
    setSelectedReviewEntry(0);
    requestAnimationFrame(() => {
      reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const overallTimeStats = useMemo(() => {
    const fromSubjects = Object.values(result.subjectStats ?? {}).reduce(
      (accumulator, stats) => {
        accumulator.correct += stats.time_spent_correct ?? 0;
        accumulator.incorrect += stats.time_spent_incorrect ?? 0;
        accumulator.unattempted += stats.time_spent_unattempted ?? 0;
        accumulator.total += stats.total_time_spent ?? 0;
        return accumulator;
      },
      { correct: 0, incorrect: 0, unattempted: 0, total: 0 },
    );

    if (fromSubjects.total > 0) {
      return fromSubjects;
    }

    const reviewStatusByQuestion = new Map(reviewEntries.map((entry) => [entry.questionId, entry.status]));
    return (result.answers ?? []).reduce(
      (accumulator, answer) => {
        const status = reviewStatusByQuestion.get(answer.questionId);
        if (status === 'correct') {
          accumulator.correct += answer.timeSpent ?? 0;
        } else if (status === 'incorrect') {
          accumulator.incorrect += answer.timeSpent ?? 0;
        } else {
          accumulator.unattempted += answer.timeSpent ?? 0;
        }
        accumulator.total += answer.timeSpent ?? 0;
        return accumulator;
      },
      { correct: 0, incorrect: 0, unattempted: 0, total: 0 },
    );
  }, [result.answers, result.subjectStats, reviewEntries]);

  const currentStats = useMemo(() => {
    if (selectedSubject === 'overall' || !result.subjectStats) {
      return {
        score: result.score || 0,
        totalMarks: (result as any).totalMarks || ((result.correctAnswers || 0) + (result.wrongAnswers || 0) + (result.unattempted || 0)) * 4 || 1,
        correct: result.correctAnswers || 0,
        incorrect: result.wrongAnswers || 0,
        unattempted: result.unattempted || 0,
        totalQs: (result.correctAnswers || 0) + (result.wrongAnswers || 0) + (result.unattempted || 0),
        accuracy: result.percentage || (result as any).accuracy || Math.round(((result.correctAnswers || 0) / (((result.correctAnswers || 0) + (result.wrongAnswers || 0)) || 1)) * 100) || 0,
        timeTaken: result.timeTaken || 0,
        timeSpentCorrect: overallTimeStats.correct,
        timeSpentIncorrect: overallTimeStats.incorrect,
        timeSpentUnattempted: overallTimeStats.unattempted,
      };
    }
    const stats = result.subjectStats[selectedSubject];
    return {
      score: stats.score || 0,
      totalMarks: stats.total_marks || 1,
      correct: stats.correct || 0,
      incorrect: stats.incorrect || 0,
      unattempted: stats.unattempted || 0,
      totalQs: stats.total_qs || 0,
      accuracy: stats.accuracy || 0,
      timeTaken: stats.total_time_spent,
      timeSpentCorrect: stats.time_spent_correct,
      timeSpentIncorrect: stats.time_spent_incorrect,
      timeSpentUnattempted: stats.time_spent_unattempted,
    };
  }, [overallTimeStats.correct, overallTimeStats.incorrect, overallTimeStats.unattempted, result, selectedSubject]);



  const formatTimeDigital = (seconds: number) => {
    const hr = Math.floor(seconds / 3600);
    const min = Math.floor((seconds % 3600) / 60);
    const sec = seconds % 60;
    if (hr > 0) return `${hr} hr ${min} min ${sec} sec`;
    if (min > 0) return `${min} min ${sec} sec`;
    return `${sec} sec`;
  };



  const displayStrongAreas = useMemo(() => {
    return result.strongAreas || (result as any).strong_areas || [];
  }, [result]);

  const displayWeakAreas = useMemo(() => {
    return result.weakAreas || (result as any).weak_areas || [];
  }, [result]);

  const subjectTimeBreakdown = useMemo(() => {
    return buildSubjectTimeBreakdown(result.subjectStats);
  }, [result.subjectStats]);
  const degradedReason = result.degradedReason ?? result.degraded_reason ?? null;
  const isAnalysisPending = analysisStatus === 'pending';

  return (
    <div className="min-h-screen neu-surface text-foreground font-sans selection:bg-primary/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[hsl(var(--neu-bg)/0.9)] backdrop-blur-xl border-b border-border/40">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 sm:gap-4 truncate">
              <button
                onClick={onBackToDashboard}
                className="p-1.5 sm:p-2 rounded-lg sm:xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div className="h-10 w-10 shrink-0 sm:h-12 sm:w-12">
                <OriMascot expression="thumbsup" title="Origin AI" />
              </div>
              <div className="truncate">
                <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight truncate">Report Card</h1>
                <p className="text-[10px] sm:text-xs text-slate-500 truncate max-w-[150px] sm:max-w-sm">
                  JEE Main - Previous Year Paper...
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
               <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1 rounded-lg">
                Attempt {history.length || 1} <ArrowRight className="w-3 h-3 ml-2 rotate-90" />
              </Badge>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 pb-4">
            <Button
              variant="secondary"
              className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary border-none rounded-xl h-9 sm:h-10 text-xs sm:text-sm"
              onClick={handleViewSolution}
            >
              View Solution
            </Button>
            <Button 
              onClick={onRetakeTest}
              variant="secondary" 
              className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary border-none rounded-xl h-9 sm:h-10 text-xs sm:text-sm"
            >
              Reattempt
            </Button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-8 overflow-x-auto no-scrollbar border-b border-border/10 mt-2">
            <button 
              onClick={() => setSelectedSubject('overall')}
              className={`pb-4 px-1 text-sm font-bold transition-all relative ${
                selectedSubject === 'overall' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${selectedSubject === 'overall' ? 'text-primary' : 'text-muted-foreground'}`} />
                Overall
              </div>
              {selectedSubject === 'overall' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full shadow-[0_0_10px_var(--primary)]" />}
            </button>
            {subjects.map(sub => (
              <button 
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`pb-4 px-1 text-sm font-bold transition-all relative capitalize ${
                  selectedSubject === sub ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                 <div className="flex items-center gap-2">
                  <Badge className={`w-2 h-2 p-0 rounded-full ${sub.toLowerCase().includes('physics') ? 'bg-orange-500' : sub.toLowerCase().includes('chemistry') ? 'bg-green-500' : 'bg-primary'} shadow-[0_0_5px_currentColor]`} />
                  {sub}
                </div>
                {selectedSubject === sub && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full shadow-[0_0_10px_var(--primary)]" />}
              </button>
            ))}
          </div>

        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8 pb-24">
        {isAnalysisPending ? (
          <DegradedBanner
            title="Analytics processing"
            reason="Your score is ready. Detailed weak-topic analysis and generated DPPs will update shortly."
          />
        ) : result.degraded ? (
          <DegradedBanner reason={degradedReason} />
        ) : null}
        {showSummary && (
          <div className="p-4 sm:p-6 bg-primary/10 border border-primary/20 rounded-2xl sm:rounded-3xl flex items-center gap-4 sm:gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
              <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">Attempt Summary</h2>
              <p className="text-xs sm:text-slate-800 dark:text-muted-foreground font-medium">
                You scored <span className="text-primary font-bold">{currentStats.score}</span> with <span className="text-primary font-bold">{currentStats.accuracy}%</span> accuracy. 
              </p>
            </div>
          </div>
        )}

        {result.isMalpractice && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-400 font-bold">
              Malpractice detected. Session was marked due to multiple screen violations.
            </p>
          </div>
        )}

        {/* Marks Obtained Card */}
        <section className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-primary/20 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <Card className="relative neu-raised border-0 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden">
            <CardContent className="p-6 sm:p-8 flex flex-col items-center">
              <div className="text-[8px] sm:text-[10px] uppercase tracking-[0.3em] font-black text-slate-800 dark:text-muted-foreground mb-4 sm:mb-6 bg-primary/5 px-4 py-1.5 rounded-full border border-primary/5">
                Marks Obtained
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl sm:text-7xl font-black text-foreground tracking-tighter drop-shadow-2xl">
                  {currentStats.score}
                </span>
                <span className="text-lg sm:text-2xl font-bold text-slate-700 dark:text-muted-foreground">/ {currentStats.totalMarks}</span>
              </div>
              <div className="mt-4 sm:mt-6 flex items-center gap-2">
                <div className={`h-1 w-32 sm:h-1.5 sm:w-48 bg-muted rounded-full overflow-hidden border border-border/5`}>
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-1000 ease-out"
                    style={{ width: `${(currentStats.score / currentStats.totalMarks) * 100}%` }}
                  />
                </div>
                <span className="text-[8px] sm:text-[10px] font-bold text-slate-700 dark:text-muted-foreground uppercase tracking-widest">
                  {Math.round((currentStats.score / currentStats.totalMarks) * 100)}%
                </span>
              </div>
            </CardContent>
          </Card>
        </section>


        {/* Quick Stats Grid */}
        <section className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card className="neu-raised border-0 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col items-center text-center group hover:bg-primary/5 transition-colors">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl bg-purple-500/10 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
              <HelpCircle className="w-4 h-4 sm:w-6 sm:h-6 text-purple-400" />
            </div>
            <div className="text-sm sm:text-xl font-black text-foreground leading-none mb-1">{currentStats.correct + currentStats.incorrect}</div>
            <div className="text-[8px] sm:text-[10px] text-slate-800 dark:text-muted-foreground font-bold uppercase tracking-widest leading-tight">Attempted</div>
          </Card>
          <Card className="neu-raised border-0 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col items-center text-center group hover:bg-primary/5 transition-colors">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl bg-primary/10 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
              <Target className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div className="text-sm sm:text-xl font-black text-foreground leading-none mb-1">{currentStats.accuracy}%</div>
            <div className="text-[8px] sm:text-[10px] text-slate-800 dark:text-muted-foreground font-bold uppercase tracking-widest leading-tight">Accuracy</div>
          </Card>
          <Card className="neu-raised border-0 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col items-center text-center group hover:bg-primary/5 transition-colors">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl bg-orange-500/10 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4 sm:w-6 sm:h-6 text-orange-400" />
            </div>
            <div className="text-sm sm:text-xl font-black text-foreground leading-none mb-1">
              {Math.floor(currentStats.timeTaken / 60)}m
            </div>
            <div className="text-[8px] sm:text-[10px] text-slate-800 dark:text-muted-foreground font-bold uppercase tracking-widest leading-tight">Time</div>
          </Card>
        </section>

        {/* Performance Trend (if history exists) */}
        {history && history.length > 1 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <h3 className="text-xl font-black text-foreground tracking-tight">Performance Trend</h3>
            </div>
            <Card className="neu-raised border-0 rounded-[2rem] p-8">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...history].reverse().slice(-5).map((h, i, arr) => ({
                    attempt: `Attempt ${history.length - arr.length + i + 1}`,
                    score: h.percentage || h.score
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                    <XAxis dataKey="attempt" hide />
                    <YAxis hide domain={[0, 'dataMax + 10']} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border border-border/50 px-3 py-2 rounded-xl">
                              <p className="text-xs font-bold text-foreground">{payload[0].value}% Accuracy</p>
                            </div>
                          );
                        }
                        return null;
                      }} 
                    />
                    <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-center">
                <p className="text-[10px] text-slate-800 dark:text-muted-foreground font-black uppercase tracking-widest leading-tight">Last {Math.min(history.length, 5)} attempts progress</p>
              </div>
            </Card>
          </section>
        )}




        {/* Attempt Analysis Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <h3 className="text-xl font-black text-foreground tracking-tight">Attempt Analysis</h3>
            </div>
            <Badge variant="outline" className="bg-primary/5 border-primary/10 text-muted-foreground font-bold px-3">
              {selectedSubject === 'overall' ? 'Overall' : selectedSubject}
            </Badge>
          </div>

          <Card className="neu-raised border-0 rounded-[2.5rem] overflow-hidden">
            <CardContent className="p-10">
              <div className="flex flex-col md:flex-row items-center justify-around gap-12">
                {/* Donut Chart */}
                <div className="relative h-48 w-48 sm:h-64 sm:w-64 animate-in fade-in zoom-in duration-700">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Correct', value: currentStats.correct, color: '#e11d48' },
                          { name: 'Incorrect', value: currentStats.incorrect, color: '#f43f5e' },
                          { name: 'Not Answered', value: currentStats.unattempted, color: '#475569' },
                        ]}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {[
                          { name: 'Correct', color: 'hsl(var(--primary))' },
                          { name: 'Incorrect', color: 'hsl(var(--primary) / 0.7)' },
                          { name: 'Not Answered', color: '#475569' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl sm:text-5xl font-black text-foreground leading-none">{currentStats.totalQs}</span>
                    <span className="text-[8px] sm:text-[10px] text-slate-800 dark:text-muted-foreground uppercase font-black tracking-[0.2em] mt-1 sm:mt-2">Total Qs</span>
                  </div>
                </div>

                {/* Legend/Stats Bar */}
                <div className="flex flex-col gap-3 sm:gap-6 w-full md:w-auto min-w-[200px]">
                  <div className="group flex items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/5 border border-border/5 hover:bg-primary/10 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
                      <span className="text-[10px] font-bold text-slate-800 dark:text-muted-foreground uppercase tracking-widest">Correct</span>
                    </div>
                    <span className="text-lg sm:text-xl font-black text-foreground">{currentStats.correct}</span>
                  </div>
                  <div className="group flex items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/5 border border-border/5 hover:bg-primary/10 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary/70 shadow-[0_0_10px_var(--primary)]" />
                      <span className="text-[10px] font-bold text-slate-800 dark:text-muted-foreground uppercase tracking-widest">Incorrect</span>
                    </div>
                    <span className="text-lg sm:text-xl font-black text-foreground">{currentStats.incorrect}</span>
                  </div>
                  <div className="group flex items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/5 border border-border/5 hover:bg-primary/10 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                      <span className="text-[10px] font-bold text-slate-800 dark:text-muted-foreground uppercase tracking-widest">Skipped</span>
                    </div>
                    <span className="text-lg sm:text-xl font-black text-foreground">{currentStats.unattempted}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>


        {/* Quality of Time Spent Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <h3 className="text-xl font-black text-foreground tracking-tight">Quality of Time Spent</h3>
            </div>
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
              <Clock className="w-3 h-3 text-primary" />
              <span className="text-xs font-bold text-primary">{formatTimeDigital(currentStats.timeTaken)}</span>
            </div>
          </div>

          <Card className="neu-raised border-0 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 overflow-hidden">
            <div className="h-48 sm:h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Correct', time: currentStats.timeSpentCorrect, color: 'hsl(var(--primary))' },
                  { name: 'Incorrect', time: currentStats.timeSpentIncorrect, color: 'hsl(var(--primary) / 0.7)' },
                  { name: 'Skipped', time: currentStats.timeSpentUnattempted, color: '#475569' }
                ]}>
                  <defs>
                    <linearGradient id="barGradientCorrect" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1}/>
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    </linearGradient>
                    <linearGradient id="barGradientIncorrect" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary) / 0.7)" stopOpacity={1}/>
                      <stop offset="100%" stopColor="hsl(var(--primary) / 0.7)" stopOpacity={0.3}/>
                    </linearGradient>
                    <linearGradient id="barGradientSkipped" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#475569" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#475569" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{fill: 'currentColor', opacity: 0.05}} 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border border-border/50 px-3 py-2 rounded-xl shadow-2xl">
                            <p className="text-xs font-bold text-foreground">{formatTimeDigital(payload[0].value as number)}</p>
                          </div>
                        );
                      }
                      return null;
                    }} 
                  />
                  <Bar dataKey="time" radius={[8, 8, 0, 0]} barSize={40}>
                    <Cell fill="url(#barGradientCorrect)" />
                    <Cell fill="url(#barGradientIncorrect)" />
                    <Cell fill="url(#barGradientSkipped)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
               <div className="bg-primary/5 border border-border/5 rounded-2xl p-4 flex flex-col items-center">
                 <div className="w-2 h-2 rounded-full bg-primary mb-2 shadow-[0_0_8px_var(--primary)]" />
                 <span className="text-[10px] text-slate-800 dark:text-muted-foreground font-bold uppercase tracking-widest mb-1">On Correct</span>
                 <span className="text-sm font-black text-foreground">{formatTimeDigital(currentStats.timeSpentCorrect)}</span>
               </div>
               <div className="bg-primary/5 border border-border/5 rounded-2xl p-4 flex flex-col items-center">
                 <div className="w-2 h-2 rounded-full bg-primary mb-2 shadow-[0_0_8px_var(--primary)]" />
                 <span className="text-[10px] text-slate-800 dark:text-muted-foreground font-bold uppercase tracking-widest mb-1">On Incorrect</span>
                 <span className="text-sm font-black text-foreground">{formatTimeDigital(currentStats.timeSpentIncorrect)}</span>
               </div>
               <div className="bg-primary/5 border border-border/5 rounded-2xl p-4 flex flex-col items-center">
                 <div className="w-2 h-2 rounded-full bg-slate-500 mb-2" />
                 <span className="text-[10px] text-slate-800 dark:text-muted-foreground font-bold uppercase tracking-widest mb-1">On Skipped</span>
                 <span className="text-sm font-black text-foreground">{formatTimeDigital(currentStats.timeSpentUnattempted)}</span>
               </div>
            </div>
          </Card>
        </section>


        {/* Detailed Analysis Tabs */}
        <Tabs
          ref={reviewSectionRef}
          value={selectedReviewTab}
          onValueChange={(value) => {
            setSelectedReviewTab(value as 'analysis' | 'mistakes' | 'correct' | 'recommendations');
            setSelectedReviewEntry(0);
          }}
          className="relative"
        >
          <TabsList className="bg-card/40 backdrop-blur-lg border border-border/5 p-1 mb-6 rounded-2xl w-full flex overflow-x-auto no-scrollbar">
            <TabsTrigger value="analysis" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl transition-all font-bold py-3">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Insights
            </TabsTrigger>
            <TabsTrigger value="mistakes" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl transition-all font-bold py-3">
              <AlertCircle className="w-4 h-4 mr-2" />
              Mistake Log
            </TabsTrigger>
            <TabsTrigger value="correct" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl transition-all font-bold py-3">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Correct Log
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl transition-all font-bold py-3">
              <Target className="w-4 h-4 mr-2" />
              Next Steps
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analysis">
            <Card className="bg-card/40 backdrop-blur-xl border-border/40 rounded-[2rem] overflow-hidden group">
              <CardContent className="p-10">
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center p-0.5 shadow-lg shadow-primary/20">
                    <div className="w-full h-full bg-background rounded-[0.9rem] flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-foreground tracking-tight">AI Diagnostic Report</h3>
                    <p className="text-sm text-slate-900 dark:text-muted-foreground font-medium">Deep learning analysis of your attempt patterns</p>
                  </div>
                </div>


                <div className="prose prose-invert max-w-none">
                  <p className="text-foreground/80 leading-relaxed text-lg font-medium">
                    {result.aiAnalysis?.summary || "AI is analyzing your summary of attempt for loading"}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 mt-12 pt-8 border-t border-border/40">
                  <div className="space-y-4">
                    <h4 className="font-black text-foreground text-sm uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      Core Strengths
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {displayStrongAreas && displayStrongAreas.length > 0 ? (
                        displayStrongAreas.map((area: any, index: number) => (
                          <Badge key={index} className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 px-4 py-1.5 rounded-xl transition-colors">
                            {typeof area === 'object' ? `${area.topic} (${area.accuracy}%)` : area}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-slate-900 dark:text-muted-foreground italic">No significant strengths identified yet.</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-black text-foreground text-sm uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      Focus Zones
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {displayWeakAreas && displayWeakAreas.length > 0 ? (
                        displayWeakAreas.map((area: any, index: number) => (
                          <Badge key={index} className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 px-4 py-1.5 rounded-xl transition-colors">
                            {typeof area === 'object' ? `${area.topic} (${area.accuracy}%)` : area}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-slate-900 dark:text-slate-500 italic">Excellent consistency across topics!</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="mistakes">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Mistake List */}
              <div className="lg:col-span-1 space-y-3">
                {mistakeEntries.length > 0 ? (
                  mistakeEntries.map((mistake, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedReviewEntry(index)}
                      className={`w-full p-5 rounded-2xl text-left transition-all border group relative overflow-hidden ${selectedReviewEntry === index
                        ? 'bg-primary/10 border-primary/50 shadow-lg shadow-primary/10'
                        : 'bg-card/40 backdrop-blur-md border-border/5 hover:bg-primary/5'
                        }`}
                    >
                      <div className="flex items-center gap-4 relative z-10">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${selectedReviewEntry === index ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`font-black uppercase tracking-tighter text-sm ${selectedReviewEntry === index ? 'text-primary' : 'text-foreground'}`}>
                            Question {index + 1}
                          </p>
                          <p className="text-xs text-slate-800 dark:text-muted-foreground font-bold truncate max-w-[150px]">{mistake.concept}</p>
                        </div>
                      </div>
                      {selectedReviewEntry === index && <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary" />}
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center bg-card/40 border border-border/5 rounded-2xl">
                    {(!result.aiAnalysis || !result.aiAnalysis.summary) ? (
                      <>
                        <Sparkles className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
                        <p className="text-sm text-foreground font-bold uppercase tracking-[0.15em] leading-relaxed">
                          AI is analyzing your summary of attempt for loading
                        </p>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4 opacity-20" />
                        <p className="text-sm text-slate-800 dark:text-muted-foreground font-bold uppercase tracking-widest">No mistakes recorded!</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Mistake Detail */}
              <Card className="lg:col-span-2 neu-raised border-0 rounded-[2rem] overflow-hidden group">
                <CardContent className="p-10">
                  {selectedReviewItem ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div>
                        <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5 rounded-full font-black uppercase tracking-widest text-[10px] mb-4">
                          <XCircle className="w-3 h-3 mr-2" />
                          Category: {selectedReviewItem.error}
                        </Badge>
                        <h3 className="text-3xl font-black text-foreground tracking-tight leading-tight">
                          {selectedReviewItem.concept}
                        </h3>
                      </div>

                      <div className="bg-foreground/5 rounded-3xl p-8 border border-border/40 relative group/item">
                        <div className="absolute -left-1 top-8 bottom-8 w-1 bg-primary rounded-full opacity-50" />
                        <h4 className="font-black text-foreground text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                          <BookOpen className="w-4 h-4 text-primary" />
                          Diagnostic Insight
                        </h4>
                        <div className="text-foreground/80 leading-relaxed font-medium">
                          <FormattedMessage content={selectedReviewItem.explanation} />
                        </div>
                      </div>

                      <div className="bg-primary/5 rounded-3xl p-8 border border-primary/10 relative">
                        <h4 className="font-black text-foreground text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                          <Target className="w-4 h-4 text-primary" />
                          Recommended strategy
                        </h4>
                        <div className="text-foreground/80 leading-relaxed font-medium">
                          <FormattedMessage content={selectedReviewItem.howToApproach} />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 pt-4">
                        <Button className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-white font-black uppercase tracking-widest text-xs px-8 h-14 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
                          <BookOpen className="w-4 h-4 mr-3" />
                          Fix Concept
                        </Button>
                        <Button variant="outline" className="rounded-2xl bg-primary/10 border border-primary/20 text-primary font-black uppercase tracking-widest text-xs px-8 h-14 hover:bg-primary/20 transition-colors">
                          <Sparkles className="w-4 h-4 mr-3 text-primary" />
                          Explain with AI
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                      <Sparkles className="w-16 h-16 text-teal-400" />
                      <p className="text-lg font-bold text-foreground">Select a mistake to see deep analysis</p>
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>
          </TabsContent>

          <TabsContent value="correct">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-3">
                {correctEntries.length > 0 ? (
                  correctEntries.map((correct, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedReviewEntry(index)}
                      className={`w-full p-5 rounded-2xl text-left transition-all border group relative overflow-hidden ${selectedReviewEntry === index
                        ? 'bg-primary/10 border-primary/50 shadow-lg shadow-primary/10'
                        : 'bg-card/40 backdrop-blur-md border-border/5 hover:bg-primary/5'
                        }`}
                    >
                      <div className="flex items-center gap-4 relative z-10">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${selectedReviewEntry === index ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`font-black uppercase tracking-tighter text-sm ${selectedReviewEntry === index ? 'text-primary' : 'text-foreground'}`}>
                            Question {index + 1}
                          </p>
                          <p className="text-xs text-slate-800 dark:text-muted-foreground font-bold truncate max-w-[150px]">{correct.concept}</p>
                        </div>
                      </div>
                      {selectedReviewEntry === index && <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary" />}
                    </button>
                  ))
                ) : (
                   <div className="p-8 text-center bg-card/40 border border-border/5 rounded-2xl">
                    <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4 opacity-20" />
                    <p className="text-sm text-slate-800 dark:text-muted-foreground font-bold uppercase tracking-widest">No correct answers recorded.</p>
                  </div>
                )}
              </div>

              {/* Correct Detail */}
              <Card className="lg:col-span-2 neu-raised border-0 rounded-[2rem] overflow-hidden group">
                <CardContent className="p-10">
                  {selectedReviewItem ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div>
                        <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5 rounded-full font-black uppercase tracking-widest text-[10px] mb-4">
                          <CheckCircle2 className="w-3 h-3 mr-2" />
                          Correct Detail
                        </Badge>
                        <div className="text-foreground/80 leading-relaxed font-medium">
                          <FormattedMessage content={selectedReviewItem.howToApproach} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                      <CheckCircle2 className="w-16 h-16 text-emerald-400" />
                      <p className="text-lg font-bold text-foreground">Select a correct answer to review how it was solved</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>


          <TabsContent value="recommendations">
            <Card className="neu-raised border-0 rounded-[2rem] overflow-hidden group">
              <CardContent className="p-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center">
                    <Target className="w-6 h-6 text-teal-400" />
                  </div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">Adaptive Learning Path</h3>
                </div>

                <div className="space-y-4">
                  {(result.aiAnalysis?.recommendations ?? []).map((rec, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-5 p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:translate-x-1 transition-all group/item"
                    >
                      <div className="w-10 h-10 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center flex-shrink-0 font-black text-sm">
                        {index + 1}
                      </div>
                      <p className="text-foreground/80 font-medium leading-relaxed">{rec}</p>
                      <ArrowRight className="w-5 h-5 text-teal-500 ml-auto opacity-0 group-hover/item:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>

                <div className="mt-12 p-10 rounded-[2.5rem] bg-gradient-to-br from-teal-500/20 to-primary/20 border border-teal-500/20 relative overflow-hidden group/dpp">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover/dpp:scale-110 transition-transform">
                    <Sparkles className="w-32 h-32 text-teal-400" />
                  </div>
                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                        <Badge className="bg-teal-500 text-white font-black px-3 py-1 rounded-lg text-[10px] uppercase tracking-widest shadow-lg shadow-teal-500/40">AI Generated</Badge>
                        <h4 className="font-black text-foreground text-xl tracking-tight">Generated DPPs Ready</h4>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                        Three analytics-backed DPPs have already been generated from your weak topics.
                        Open them in order to repair gaps first and reinforce them after.
                      </p>
                    </div>
                    <Button
                      onClick={onViewDPP}
                      className="bg-white text-[#0F172A] hover:bg-slate-200 font-black uppercase tracking-widest text-xs h-14 px-10 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                    >
                      <FileText className="w-4 h-4 mr-3" />
                      Open DPPs
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}
