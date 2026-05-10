'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Search,
  Clock,
  HelpCircle,
  BarChart3,
  ChevronLeft,
  Play,
  RotateCcw,
  Lock,
  CheckCircle2,
  Flame,
  BookOpen,
  Atom,
  Calculator,
  Plus,
  Loader2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import type { Test, TestPreview, User } from '@/types';
import { apiCall } from '@/lib/api';
import { createCustomTestAction } from '@/server/actions/test-actions';

interface TestListProps {
  onStartTest: (test: TestPreview) => void;
  onViewAnalysis: (test: TestPreview) => void;
  onBack: () => void;
  user: User;
  /** Pre-loaded by the Server Component — skips the initial client-side fetch */
  initialTests?: TestPreview[];
}

function toTestPreview(test: Test | TestPreview): TestPreview {
  return {
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    chapter: test.chapter,
    difficulty: test.difficulty,
    duration: test.duration,
    totalQuestions: test.totalQuestions,
    isPremium: test.isPremium,
    isCustom: test.isCustom,
    attempted: test.attempted,
    score: test.score,
    attemptCount: test.attemptCount,
    allScores: test.allScores,
  };
}

export default function TestList({ onStartTest, onViewAnalysis, onBack, user, initialTests }: TestListProps) {
  const [tests, setTests] = useState<TestPreview[]>(initialTests ?? []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [loading, setLoading] = useState(!initialTests);

  const [customTestConfig, setCustomTestConfig] = useState({
    subject: 'mixed',
    difficulty: 'medium',
    chapter: '',
    question_count: 10
  });
  const [creatingTest, setCreatingTest] = useState(false);
  const [customTestError, setCustomTestError] = useState('');

  const handleCreateCustomTest = async () => {
    setCreatingTest(true);
    setCustomTestError('');
    try {
      const response = (await createCustomTestAction(customTestConfig)) as Test;
      // Add the new test to the top of the list and mark as custom
      const newTest = { ...toTestPreview(response), isCustom: true };
      setTests((prev) => [newTest, ...prev]);
      // Auto-start the test after creating it
      onStartTest(newTest);
    } catch (error: any) {
      setCustomTestError(error.message || 'Failed to create custom test. Try making it broader.');
    } finally {
      setCreatingTest(false);
    }
  };

  useEffect(() => {
    if (initialTests) return; // SSR already provided the data — skip client fetch
    const fetchTests = async () => {
      try {
        const data = await apiCall('/assessments/tests/');
        setTests(Array.isArray(data) ? (data as TestPreview[]) : []);
      } catch (error) {
        console.error('Failed to fetch tests:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTests();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredTests = tests.filter((test) => {
    const matchesSearch = test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || test.subject === selectedSubject;
    const matchesDifficulty = selectedDifficulty === 'all' || test.difficulty === selectedDifficulty;
    return matchesSearch && matchesSubject && matchesDifficulty;
  });

  const standardTests = filteredTests.filter(t => !t.isCustom && !(t as any).is_custom && !t.id.startsWith('custom_'));
  const customTests = filteredTests.filter(t => t.isCustom || (t as any).is_custom || t.id.startsWith('custom_'));

  const getSubjectIcon = (subject: string) => {
    switch (subject) {
      case 'physics':
        return <Atom className="w-5 h-5" />;
      case 'chemistry':
        return <Flame className="w-5 h-5" />;
      case 'mathematics':
        return <Calculator className="w-5 h-5" />;
      case 'biology':
        return <BookOpen className="w-5 h-5" />;
      default:
        return <BookOpen className="w-5 h-5" />;
    }
  };
  
  const getSubjectColor = (subject: string) => {
    switch (subject) {
      case 'physics':
        return 'bg-primary/10 text-primary';
      case 'chemistry':
        return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400';
      case 'mathematics':
        return 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400';
      case 'biology':
        return 'bg-primary/20 text-primary';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-500/20';
      case 'medium':
        return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border-amber-500/20';
      case 'hard':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div id="tutorial-test-hub" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary/5 dark:from-slate-950 dark:via-slate-900 dark:to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-40 glass dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Test Series</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Choose a test to begin</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-[10px] sm:text-sm font-bold truncate max-w-[60px] sm:max-w-none">{user.streak || 0}d streak</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading tests...</div>
        ) : (
          <>
            {/* Filters moved to tab */}


            {/* Tabs */}
            <Tabs defaultValue="all" className="mb-12">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 border-b border-border/40 pb-6">
                <TabsList className="bg-transparent p-0 flex flex-wrap gap-1 sm:gap-2 h-auto justify-start">
                  {(['all', 'recommended', 'attempted', 'gallery', 'build', 'pyq', 'search'] as const).map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      {tab === 'all' ? 'Institute' : 
                       tab === 'recommended' ? 'Daily' : 
                       tab === 'pyq' ? 'PYQ Tests' :
                       tab === 'attempted' ? 'Performance' : 
                       tab === 'gallery' ? 'My Tests' : 
                       tab === 'build' ? 'Build' : 'Search'}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="px-3 py-1 rounded-full border-primary/20 bg-primary/5 text-primary font-bold text-[10px] uppercase tracking-widest">
                    {tests.length} Total Tests
                  </Badge>
                </div>
              </div>

              {/* All Tests (Standard Only) */}
              <TabsContent value="all" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {standardTests.map((test) => (
                    <TestCard
                      key={test.id}
                      test={test}
                      onStart={() => onStartTest(test)}
                      onViewAnalysis={() => onViewAnalysis(test)}
                      user={user}
                      getSubjectIcon={getSubjectIcon}
                      getSubjectColor={getSubjectColor}
                      getDifficultyColor={getDifficultyColor}
                    />
                  ))}
                  {standardTests.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                      <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Calibrating Mocks...</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Daily Recommendations */}
              <TabsContent value="recommended" className="mt-0 outline-none">
                <div className="mb-8 p-6 rounded-[32px] bg-primary text-white relative overflow-hidden shadow-xl shadow-primary/20">
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter mb-1">Personalized Intelligence</h2>
                      <p className="text-xs font-bold opacity-80 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Tests curated for your primary subjects
                      </p>
                    </div>
                    {user.subjects && user.subjects.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {user.subjects.map(sub => (
                          <Badge key={sub} className="bg-white/20 hover:bg-white/30 text-white border-0 font-bold uppercase text-[10px]">
                            {sub}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {standardTests
                    .filter(t => !t.attempted)
                    .filter(t => {
                      if (user.subjects && user.subjects.length > 0) {
                        return user.subjects.some(sub =>
                          t.subject.toLowerCase() === sub.toLowerCase() || t.subject === 'mixed'
                        );
                      }
                      return true;
                    })
                    .map((test) => (
                      <TestCard
                        key={test.id}
                        test={test}
                        onStart={() => onStartTest(test)}
                        onViewAnalysis={() => onViewAnalysis(test)}
                        user={user}
                        getSubjectIcon={getSubjectIcon}
                        getSubjectColor={getSubjectColor}
                        getDifficultyColor={getDifficultyColor}
                      />
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="pyq" className="mt-0 outline-none">
                <Tabs defaultValue="jee-main" className="w-full">
                  <div className="flex justify-center mb-8">
                    <TabsList className="bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-2xl">
                      <TabsTrigger value="jee-main" className="rounded-xl px-6 py-2 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">JEE Main</TabsTrigger>
                      <TabsTrigger value="jee-advanced" className="rounded-xl px-6 py-2 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">JEE Advanced</TabsTrigger>
                      <TabsTrigger value="neet" className="rounded-xl px-6 py-2 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">NEET</TabsTrigger>
                    </TabsList>
                  </div>

                  {(['jee-main', 'jee-advanced', 'neet'] as const).map(exam => {
                    const examTests = standardTests.filter(t => {
                       const title = t.title.toLowerCase();
                       const desc = t.description.toLowerCase();
                       const isPyq = title.includes('pyq') || desc.includes('pyq') || title.includes('previous year') || desc.includes('previous year');
                       if (!isPyq) return false;
                       if (exam === 'jee-main') return title.includes('jee main') || title.includes('mains') || desc.includes('jee main');
                       if (exam === 'jee-advanced') return title.includes('jee adv') || title.includes('advanced') || desc.includes('advanced');
                       if (exam === 'neet') return title.includes('neet') || desc.includes('neet');
                       return false;
                    });
                    
                    return (
                      <TabsContent key={exam} value={exam} className="mt-0 outline-none">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {examTests.map((test) => (
                            <TestCard
                              key={test.id}
                              test={test}
                              onStart={() => onStartTest(test)}
                              onViewAnalysis={() => onViewAnalysis(test)}
                              user={user}
                              getSubjectIcon={getSubjectIcon}
                              getSubjectColor={getSubjectColor}
                              getDifficultyColor={getDifficultyColor}
                            />
                          ))}
                          {examTests.length === 0 && (
                            <div className="col-span-full py-20 text-center border-2 border-dashed border-border/40 rounded-[40px] bg-slate-50/50 dark:bg-white/5">
                              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4 opacity-50" />
                              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No PYQ tests available for this category</p>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    )
                  })}
                </Tabs>
              </TabsContent>

              <TabsContent value="attempted" className="mt-0 outline-none">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTests.filter(t => t.attempted).map((test) => (
                    <TestCard
                      key={test.id}
                      test={test}
                      onStart={() => onStartTest(test)}
                      onViewAnalysis={() => onViewAnalysis(test)}
                      user={user}
                      getSubjectIcon={getSubjectIcon}
                      getSubjectColor={getSubjectColor}
                      getDifficultyColor={getDifficultyColor}
                    />
                  ))}
                  {filteredTests.filter(t => t.attempted).length === 0 && (
                    <div className="col-span-full py-24 text-center border-2 border-dashed border-border/40 rounded-[40px] bg-slate-50/50 dark:bg-white/5">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <BarChart3 className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-sm font-black text-slate-500 uppercase tracking-widest">No Attempt History</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Custom Gallery (Gallery) */}
              <TabsContent value="gallery" className="mt-0 outline-none">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {customTests.map((test) => (
                    <TestCard
                      key={test.id}
                      test={test}
                      onStart={() => onStartTest(test)}
                      onViewAnalysis={() => onViewAnalysis(test)}
                      user={user}
                      getSubjectIcon={getSubjectIcon}
                      getSubjectColor={getSubjectColor}
                      getDifficultyColor={getDifficultyColor}
                    />
                  ))}
                  {customTests.length === 0 && !creatingTest && (
                    <Card 
                      onClick={() => {}} // Tab switch logic handled by defaultValue or programmatic change would be better
                      className="col-span-full border-2 border-dashed border-border/40 bg-slate-50/50 dark:bg-white/5 rounded-[40px] flex flex-col items-center justify-center p-20 text-center"
                    >
                      <div className="w-20 h-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                        <Plus className="w-10 h-10" />
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter">Generator Empty</h3>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-8">No custom tests found in your gallery.</p>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Build Lab (The Creator UI) */}
              <TabsContent value="build" className="mt-0 outline-none">
                <div className="max-w-4xl mx-auto">
                    <Card className="border-0 bg-white/40 dark:bg-white/5 backdrop-blur-xl shadow-soft rounded-[40px] overflow-hidden">
                        <div className="p-6 sm:p-10 border-b border-border/40 bg-primary text-white relative">
                            <div className="relative z-10">
                                <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter mb-2">Test Builder</h2>
                                <p className="text-[10px] sm:text-xs font-bold opacity-80 uppercase tracking-widest">Configure your session</p>
                            </div>
                            <Plus className="absolute top-6 right-6 sm:top-10 sm:right-10 w-12 h-12 sm:w-20 sm:h-20 opacity-10" />
                        </div>
                        <div className="p-6 sm:p-10 space-y-6 sm:space-y-10">
                            <div className="grid sm:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Domain Calibration</Label>
                                    <select
                                        value={customTestConfig.subject}
                                        onChange={(e) => setCustomTestConfig({ ...customTestConfig, subject: e.target.value })}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-white/5 border border-border/40 text-slate-900 dark:text-white font-black text-sm outline-none focus:border-rose-500 transition-all"
                                    >
                                        <option value="mixed">All Subjects (Mixed)</option>
                                        <option value="physics">Physics</option>
                                        <option value="chemistry">Chemistry</option>
                                        <option value="mathematics">Mathematics</option>
                                        <option value="biology">Biology</option>
                                    </select>
                                </div>
                                <div className="space-y-4">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Intensity Level</Label>
                                    <select
                                        value={customTestConfig.difficulty}
                                        onChange={(e) => setCustomTestConfig({ ...customTestConfig, difficulty: e.target.value })}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-white/5 border border-border/40 text-slate-900 dark:text-white font-black text-sm outline-none focus:border-rose-500 transition-all"
                                    >
                                        <option value="all">Dynamic Difficulty</option>
                                        <option value="easy">Introductory (Easy)</option>
                                        <option value="medium">Standard (Medium)</option>
                                        <option value="hard">Advanced (Hard)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Chapter Specificity (Optional)</Label>
                                <Input
                                    placeholder="e.g. Kinematics, Thermodynamics..."
                                    value={customTestConfig.chapter}
                                    onChange={(e) => setCustomTestConfig({ ...customTestConfig, chapter: e.target.value })}
                                    className="h-14 rounded-2xl bg-white dark:bg-white/5 border border-border/40 px-5 text-sm font-bold"
                                />
                            </div>

                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Question Load</Label>
                                    <span className="text-sm font-black text-rose-600 dark:text-rose-400">{customTestConfig.question_count} UNITS</span>
                                </div>
                                <Slider
                                    value={[customTestConfig.question_count]}
                                    onValueChange={(val) => setCustomTestConfig({ ...customTestConfig, question_count: val[0] })}
                                    max={30}
                                    min={5}
                                    step={5}
                                    className="py-2"
                                />
                            </div>

                            {customTestError && (
                                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold text-center">
                                    {customTestError}
                                </div>
                            )}

                            <Button
                                onClick={handleCreateCustomTest}
                                disabled={creatingTest}
                                className="w-full h-16 rounded-3xl bg-primary text-white font-black text-lg uppercase tracking-tighter transition-all shadow-xl shadow-primary/20"
                            >
                                {creatingTest ? (
                                    <div className="flex items-center gap-3">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Generating Intelligence...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <Play className="w-5 h-5" />
                                        Initialize Test Session
                                    </div>
                                )}
                            </Button>
                        </div>
                    </Card>
                </div>
              </TabsContent>

              {/* Search Laboratory (Filters) */}
              <TabsContent value="search" className="mt-0 outline-none">
                <Card className="border-0 bg-white/40 dark:bg-white/5 backdrop-blur-xl shadow-soft rounded-[2rem] sm:rounded-[40px] p-6 sm:p-10">
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Query Input</Label>
                      <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                          placeholder="Search tests by title or description..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-14 h-14 rounded-2xl border-border/40 bg-white dark:bg-white/10 focus:border-rose-500/50 font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Subject Filtering</Label>
                        <select
                          value={selectedSubject}
                          onChange={(e) => setSelectedSubject(e.target.value)}
                          className="w-full h-14 px-5 rounded-2xl border border-border/40 bg-white dark:bg-white/5 font-bold outline-none focus:border-rose-500 transition-all"
                        >
                          <option value="all">All Subjects</option>
                          <option value="physics">Physics</option>
                          <option value="chemistry">Chemistry</option>
                          <option value="mathematics">Mathematics</option>
                          <option value="biology">Biology</option>
                          <option value="mixed">Mixed</option>
                        </select>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Complexity Selection</Label>
                        <select
                          value={selectedDifficulty}
                          onChange={(e) => setSelectedDifficulty(e.target.value)}
                          className="w-full h-14 px-5 rounded-2xl border border-border/40 bg-white dark:bg-white/5 font-bold outline-none focus:border-rose-500 transition-all"
                        >
                          <option value="all">All Levels</option>
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-between items-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Match Found: <span className="text-rose-600 dark:text-rose-400">{filteredTests.length} tests</span>
                      </p>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedSubject('all');
                          setSelectedDifficulty('all');
                        }}
                        className="rounded-xl text-xs font-black uppercase text-rose-500 hover:bg-rose-500/10"
                      >
                        Reset All Parameters
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Visual feedback of active filters */}
                {(searchQuery || selectedSubject !== 'all' || selectedDifficulty !== 'all') && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {searchQuery && <Badge variant="secondary">Search: {searchQuery}</Badge>}
                    {selectedSubject !== 'all' && <Badge variant="secondary">Subject: {selectedSubject}</Badge>}
                    {selectedDifficulty !== 'all' && <Badge variant="secondary">Level: {selectedDifficulty}</Badge>}
                  </div>
                )}

                {filteredTests.length > 0 ? (
                  <div className="mt-12">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-8 flex items-center gap-4">
                      Query Results
                      <div className="flex-1 h-px bg-border/40" />
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredTests.map((test) => (
                        <TestCard
                          key={test.id}
                          test={test}
                          onStart={() => onStartTest(test)}
                          onViewAnalysis={() => onViewAnalysis(test)}
                          user={user}
                          getSubjectIcon={getSubjectIcon}
                          getSubjectColor={getSubjectColor}
                          getDifficultyColor={getDifficultyColor}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}

interface TestCardProps {
  test: TestPreview;
  onStart: () => void;
  onViewAnalysis: () => void;
  user: User;
  getSubjectIcon: (subject: string) => React.ReactNode;
  getSubjectColor: (subject: string) => string;
  getDifficultyColor: (difficulty: string) => string;
}

function TestCard({ test, onStart, onViewAnalysis, user, getSubjectIcon, getSubjectColor, getDifficultyColor }: TestCardProps) {
  const isLocked = test.isPremium && !user.isPremium;

  return (
    <Card className={`group relative border-0 bg-card/40 dark:bg-white/5 backdrop-blur-xl shadow-soft hover:shadow-primary/10 transition-all duration-500 rounded-[2rem] sm:rounded-[32px] overflow-hidden ${isLocked ? 'grayscale opacity-80' : ''}`}>
      <CardContent className="p-5 sm:p-8">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4 sm:mb-8">
          <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl ${getSubjectColor(test.subject)} flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500`}>
            {getSubjectIcon(test.subject)}
          </div>
          <div className="flex flex-col items-end gap-2">
            {test.attempted && (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Completed
              </Badge>
            )}
            {isLocked && (
              <Badge className="bg-amber-500 text-white border-0 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest shadow-lg shadow-amber-500/20">
                <Lock className="w-3 h-3 mr-1" />
                Premium
              </Badge>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-2 leading-tight uppercase tracking-tighter transition-colors group-hover:text-primary transition-colors">
            {test.title}
          </h3>
          <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
            {test.description}
          </p>
        </div>

        {/* Intelligence Stats */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-border/40 flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
            <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Questions</p>
                <p className="text-xs font-black text-slate-900 dark:text-white leading-none">{test.totalQuestions}</p>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-border/40 flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Duration</p>
                <p className="text-xs font-black text-slate-900 dark:text-white leading-none">{test.duration}m</p>
            </div>
          </div>
        </div>

        {/* Difficulty Anchor */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
            <Badge variant="outline" className={`${getDifficultyColor(test.difficulty)} border px-3 sm:px-4 py-1 rounded-full font-black text-[9px] sm:text-[10px] uppercase tracking-[0.15em]`}>
                {test.difficulty}
            </Badge>
            {test.score !== undefined && test.score !== null && (
                <div className="text-right">
                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Score</p>
                    <p className="text-base sm:text-lg font-black text-primary leading-none">{test.score}%</p>
                </div>
            )}
        </div>

        {/* Force-Action Primary */}
        <div className="space-y-3">
          {isLocked ? (
            <Button
              disabled
              className="w-full h-12 rounded-2xl bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest cursor-not-allowed"
            >
              <Lock className="w-3.5 h-3.5 mr-2" />
              Subscribe to Unlock
            </Button>
          ) : test.attempted ? (
            <div className="flex flex-col gap-3">
              <Button
                onClick={onViewAnalysis}
                className="w-full h-14 rounded-[20px] bg-primary text-white font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-primary/20 group/btn"
              >
                <BarChart3 className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                Deep Intelligence
              </Button>
              <Button
                onClick={onStart}
                variant="ghost"
                className="w-full h-12 rounded-2xl text-slate-500 hover:text-primary font-black uppercase text-[10px] tracking-widest transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-2" />
                Retest Simulation
              </Button>
            </div>
          ) : (
            <Button
              onClick={onStart}
              className="w-full h-12 sm:h-14 rounded-xl sm:rounded-[20px] bg-primary hover:scale-[1.02] active:scale-[0.98] text-white font-black uppercase text-[10px] sm:text-xs tracking-widest transition-all shadow-xl shadow-primary/30 group/btn"
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 fill-current group-hover/btn:translate-x-1 transition-transform" />
              Initialize Mock
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-2 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
            </Button>
          )}
        </div>
      </CardContent>
      {/* Decorative pulse glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-16 translate-x-16 group-hover:bg-primary/10 transition-colors" />
    </Card>
  );
}
