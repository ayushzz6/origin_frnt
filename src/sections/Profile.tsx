'use client';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronLeft,
  User,
  GraduationCap,
  Crown,
  Edit3,
  BookOpen,
  Clock,
  Trophy,
  TrendingUp,
  Target,
  Calendar,
  Camera,
  Settings,
  Bell,
  Shield,
  Sun,
  Moon,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { apiCall } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { updateProfileAction } from '@/server/actions/profile-actions';
import type { User as UserType, StreakData } from '@/types';
import PhotoBooth from '@/components/profile/PhotoBooth';
import { INDIAN_STATES } from '@/lib/constants';

interface ProfileProps {
  user: UserType;
  streakData: StreakData;
  onBack: () => void;
  onUpgrade: () => void;
  initialProfileStats?: ProfileStats | null;
}

interface ProfileStats {
  tests_taken: number;
  study_hours: number;
  global_rank: number | null;
  subject_progress: Array<{ subject: string; accuracy: number }>;
  overall_accuracy: number;
  achievements: {
    first_test: boolean;
    streak_7: boolean;
    doubt_master: boolean;
    top_100: boolean;
    perfect_score: boolean;
    streak_30: boolean;
  };
}

import { getUserTitle } from '@/lib/achievements';

export default function Profile({
  user,
  streakData,
  onBack,
  onUpgrade,
  initialProfileStats = null,
}: ProfileProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { refreshUser } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(initialProfileStats);

  const title = getUserTitle(user);
  const displayName = title ? `${title} ${user.name}` : user.name;

  const [editData, setEditData] = useState({
    name: user.name,
    class: user.class || '',
    selectedCourse: user.selectedCourse || '',
    subjects: user.subjects || [],
    location: user.location || '',
  });

  // Sync state with user prop if updated externally
  useEffect(() => {
    setEditData({
      name: user.name,
      class: user.class || '',
      selectedCourse: user.selectedCourse || '',
      subjects: user.subjects || [],
      location: user.location || '',
    });
  }, [user]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (initialProfileStats) {
      return;
    }

    apiCall('/users/stats/').then((data: ProfileStats) => setProfileStats(data)).catch(() => {});
  }, [initialProfileStats]);

  const toggleDarkMode = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updatedUser = await updateProfileAction(editData);
      setEditData({
        name: updatedUser.name,
        class: updatedUser.class || '',
        selectedCourse: updatedUser.selectedCourse || '',
        subjects: updatedUser.subjects || [],
        location: updatedUser.location || '',
      });
      await refreshUser();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const SUBJECT_COLORS: Record<string, string> = {
    Physics: 'bg-primary',
    Chemistry: 'bg-primary/80',
    Mathematics: 'bg-primary/60',
    Biology: 'bg-primary/40',
  };

  const subjectProgress = (profileStats?.subject_progress ?? []).map((s) => ({
    subject: s.subject,
    progress: s.accuracy,
    color: SUBJECT_COLORS[s.subject] ?? 'bg-primary',
  }));

  const achievements = [
    { name: 'First Test', description: 'Completed your first test', icon: BookOpen, unlocked: profileStats?.achievements.first_test ?? false },
    { name: '7-Day Streak', description: 'Studied 7 days in a row', icon: TrendingUp, unlocked: profileStats?.achievements.streak_7 ?? false },
    { name: 'Doubt Master', description: 'Solved 50 doubts', icon: Target, unlocked: profileStats?.achievements.doubt_master ?? false },
    { name: 'Top 100', description: 'Reached top 100 rank', icon: Trophy, unlocked: profileStats?.achievements.top_100 ?? false },
    { name: 'Perfect Score', description: 'Scored 100% on a test', icon: Crown, unlocked: profileStats?.achievements.perfect_score ?? false },
    { name: '30-Day Streak', description: 'Studied 30 days in a row', icon: Calendar, unlocked: profileStats?.achievements.streak_30 ?? false },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary transition-colors duration-300 relative overflow-x-hidden">
      {/* Premium Background Decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(circle at 80% 30%, var(--primary) 0%, transparent 40%),
                                radial-gradient(circle at 20% 70%, var(--primary) 0%, transparent 40%)`
        }}>
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] mix-blend-overlay"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-xl border-b border-border transition-all">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <div className="flex items-center gap-4">
                <button
                  onClick={onBack}
                  className="p-2.5 rounded-xl bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-primary transition-all border border-border shadow-sm"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="h-8 w-[1px] bg-border mx-1" />
                <h1 className="text-xl font-black tracking-tight">Profile Settings</h1>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleDarkMode}
                  className="p-2.5 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground transition-all"
                >
                  {mounted ? (resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />) : <Moon className="w-5 h-5" />}
                </button>
                <button className="p-2.5 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground transition-all">
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full mb-20">
          {/* Profile Header */}
          <Card className="border border-border shadow-2xl shadow-primary/5 bg-card backdrop-blur-xl mb-10 relative overflow-hidden ring-1 ring-border">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10 pointer-events-none" />
            <CardContent className="relative z-10 p-8 sm:p-10">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                {/* Avatar */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-primary rounded-full opacity-30 blur group-hover:opacity-50 transition duration-500" />
                  <Avatar className="w-28 h-28 border-4 border-card dark:border-slate-800 relative z-10">
                    <AvatarFallback className="bg-primary text-white text-4xl font-black">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <button className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border-2 border-card dark:border-slate-800 hover:scale-110 transition-transform z-20">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-4 mb-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="text-3xl font-black tracking-tight bg-transparent border-b-2 border-primary/30 focus:border-primary outline-none max-w-[200px] sm:max-w-[300px]"
                        placeholder="Your Name"
                        autoFocus
                      />
                    ) : (
                      <h2 className="text-3xl font-black tracking-tight">{displayName}</h2>
                    )}
                    {user.isPremium && (
                      <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/20 border-0 h-6">
                        <Crown className="w-3 h-3 mr-1" />
                        PREMIUM
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground font-medium mb-5">{user.email}</p>

                  <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                    {isEditing ? (
                      <div className="flex flex-col gap-4 w-full">
                        <div className="flex gap-4">
                          <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-bold uppercase text-slate-500">Class</label>
                            <select
                              value={editData.class}
                              onChange={(e) => setEditData({ ...editData, class: e.target.value })}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-800 dark:text-white"
                            >
                              <option value="9">Class 9</option>
                              <option value="10">Class 10</option>
                              <option value="11">Class 11</option>
                              <option value="12">Class 12</option>
                              <option value="dropper">Dropper</option>
                            </select>
                          </div>
                          <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-bold uppercase text-slate-500">Course</label>
                            <select
                              value={editData.selectedCourse}
                              onChange={(e) => setEditData({ ...editData, selectedCourse: e.target.value })}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-800 dark:text-white"
                            >
                              <option value="JEE">JEE</option>
                              <option value="NEET">NEET</option>
                              {['9', '10'].includes(editData.class) && (
                                <option value="Foundation">Foundation</option>
                              )}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-bold uppercase text-slate-500">Region/State</label>
                            <select
                              value={editData.location}
                              onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-slate-800 dark:text-white"
                            >
                              <option value="">Select Region</option>
                              {INDIAN_STATES.map(state => (
                                <option key={state} value={state}>{state}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase text-slate-500">Subjects</label>
                          <div className="flex flex-wrap gap-2">
                            {['Physics', 'Chemistry', 'Mathematics', 'Biology'].map(s => (
                              <Badge
                                key={s}
                                onClick={() => {
                                  const newSubjects = editData.subjects.includes(s)
                                    ? editData.subjects.filter(sub => sub !== s)
                                    : [...editData.subjects, s];
                                  setEditData({ ...editData, subjects: newSubjects });
                                }}
                                className={`cursor-pointer px-4 py-1.5 h-auto text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${editData.subjects.includes(s)
                                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                  : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 border border-transparent'
                                  }`}
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Badge variant="secondary" className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-0 shadow-sm font-bold text-[10px] uppercase tracking-wider">
                          <GraduationCap className="w-3.5 h-3.5 mr-1.5" />
                          Class {editData.class === 'dropper' ? 'Dropper' : (editData.class || 'Not Set')}
                        </Badge>
                        <Badge variant="secondary" className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-0 shadow-sm font-bold text-[10px] uppercase tracking-wider">
                          <Target className="w-3.5 h-3.5 mr-1.5" />
                          {editData.selectedCourse || 'No Course'}
                        </Badge>
                        <Badge variant="secondary" className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-0 shadow-sm font-bold text-[10px] uppercase tracking-wider">
                          <MapPin className="w-3.5 h-3.5 mr-1.5" />
                          {editData.location || 'Global'}
                        </Badge>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {editData.subjects.map((s: string) => (
                            <Badge key={s} variant="outline" className="text-[10px] font-bold border-primary/20 text-primary">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Edit Button */}
                <div className="flex flex-col gap-2">
                  <Button
                    variant={isEditing ? "default" : "outline"}
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    disabled={isLoading}
                    className={`rounded-xl px-6 h-11 font-bold transition-all shadow-sm ${isEditing
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-secondary"
                      }`}
                  >
                    {isEditing ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit Profile
                      </>
                    )}
                  </Button>
                  {isEditing && (
                    <Button
                      variant="ghost"
                      onClick={() => setIsEditing(false)}
                      className="text-xs text-slate-500"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { label: 'Tests Taken', value: profileStats ? String(profileStats.tests_taken) : '—', icon: BookOpen, color: 'text-primary shadow-primary/10' },
              { label: 'Study Hours', value: profileStats ? String(profileStats.study_hours) : '—', icon: Clock, color: 'text-emerald-500 shadow-emerald-500/10' },
              { label: 'Current Streak', value: `${streakData.currentStreak} days`, icon: TrendingUp, color: 'text-orange-500 shadow-orange-500/10' },
              { label: 'Global Rank', value: profileStats ? (profileStats.global_rank ? `#${profileStats.global_rank}` : '—') : '—', icon: Trophy, color: 'text-primary shadow-primary/10' },
            ].map((stat, index) => (
              <Card key={index} className="border border-border shadow-lg bg-card backdrop-blur-xl ring-1 ring-border hover:scale-[1.02] transition-all group cursor-default">
                <CardContent className="p-6 text-center">
                  <div className={`w-12 h-12 mx-auto rounded-2xl bg-secondary/50 flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <p className="text-2xl font-black tracking-tight">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="progress" className="mb-10">
            <TabsList className="bg-secondary/50 p-1.5 w-full h-14 rounded-2xl backdrop-blur-md border border-border">
              {[
                { value: 'progress', icon: TrendingUp, label: 'Progress' },
                { value: 'photobooth', icon: Sparkles, label: 'AI Booth' },
                { value: 'achievements', icon: Trophy, label: 'Achievements' },
                { value: 'settings', icon: Settings, label: 'Settings' }
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex-1 h-full rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg text-muted-foreground font-bold text-sm tracking-tight transition-all"
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="progress" className="mt-8">
              <Card className="border border-border shadow-xl bg-card backdrop-blur-xl ring-1 ring-border overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-black flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-primary rounded-full" />
                    Subject Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-6">
                    {subjectProgress.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No practice data yet. Start solving questions to see your progress.</p>
                    )}
                    {subjectProgress.map((subject) => (
                      <div key={subject.subject}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-900 dark:text-white">{subject.subject}</span>
                          <span className="text-sm text-slate-500 dark:text-slate-400">{subject.progress}%</span>
                        </div>
                        <div className="h-3 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full ${subject.color} rounded-full transition-all duration-500`}
                            style={{ width: `${subject.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 p-8 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10 dark:to-secondary/20 ring-1 ring-primary/20">
                    <h4 className="font-bold mb-2">Overall Practice Accuracy</h4>
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 relative flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-secondary" />
                          <circle
                            cx="48"
                            cy="48"
                            r="42"
                            fill="none"
                            stroke="url(#primary-grad)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${((profileStats?.overall_accuracy ?? 0) / 100) * 264} 264`}
                          />
                          <defs>
                            <linearGradient id="primary-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="hsl(var(--primary))" />
                              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-black text-primary">{profileStats?.overall_accuracy ?? 0}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                          {(profileStats?.overall_accuracy ?? 0) >= 70
                            ? <>You&apos;re doing great! Keep pushing your accuracy higher.</>
                            : (profileStats?.overall_accuracy ?? 0) > 0
                            ? <>Keep practicing to improve your accuracy. You can do it!</>
                            : <>Start practicing questions to track your performance here.</>}
                        </p>
                        <Button
                          variant="ghost"
                          className="text-primary p-0 h-auto mt-2 font-bold hover:bg-transparent"
                          onClick={onBack}
                        >
                          Continue Learning →
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="photobooth" className="mt-8">
              <PhotoBooth />
            </TabsContent>

            <TabsContent value="achievements" className="mt-8">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {achievements.map((achievement, index) => (
                  <Card
                    key={index}
                    className={`border border-border shadow-lg ${achievement.unlocked ? 'bg-card' : 'bg-muted/10 opacity-60'} backdrop-blur-xl ring-1 ring-border group transition-all`}
                  >
                    <CardContent className="p-8 text-center">
                      <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${achievement.unlocked
                        ? 'bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20'
                        : 'bg-secondary'
                        }`}>
                        <achievement.icon className={`w-8 h-8 ${achievement.unlocked ? 'text-white' : 'text-muted-foreground'}`} />
                      </div>
                      <h4 className="font-black tracking-tight leading-tight mb-1">{achievement.name}</h4>
                      <p className="text-[10px] text-muted-foreground font-medium">{achievement.description}</p>
                      {achievement.unlocked && (
                        <Badge className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-0 font-bold text-[9px]">UNLOCKED</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-8">
              <Card className="border-0 shadow-xl bg-card dark:bg-slate-900/60 backdrop-blur-xl ring-1 ring-slate-100 dark:ring-white/5">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {[
                      { icon: User, label: 'Personal Information', desc: 'Update your name, email, and bio', color: 'bg-primary/5 text-primary' },
                      { icon: Bell, label: 'Notifications', desc: 'Manage your alert preferences', color: 'bg-primary/5 text-primary' },
                      { icon: Shield, label: 'Privacy & Security', desc: 'Password, 2FA, and sessions', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' }
                    ].map((item, idx) => (
                      <button key={idx} className="w-full flex items-center gap-5 p-4 rounded-2xl hover:bg-secondary transition-all border border-transparent hover:border-border group">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${item.color}`}>
                          <item.icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 text-left">
                          <h4 className="font-bold leading-tight">{item.label}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 rotate-180 transition-all" />
                      </button>
                    ))}

                    <div className="pt-4 border-t border-border mt-2">
                      {!user.isPremium && (
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-xl shadow-primary/20 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                          <div className="flex items-center gap-4 mb-3 relative z-10">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                              <Crown className="w-6 h-6 text-amber-300" />
                            </div>
                            <h4 className="font-black text-lg tracking-tight">Upgrade to ORIGIN Pro</h4>
                          </div>
                          <p className="text-primary-foreground/80 text-xs mb-5 font-medium leading-relaxed relative z-10">
                            Unlock unlimited mock tests, deep performance analysis, and priority doubt resolution.
                          </p>
                          <Button
                            onClick={onUpgrade}
                            className="w-full bg-background text-primary hover:bg-background/90 font-black h-11 rounded-xl shadow-lg relative z-10"
                          >
                            Unlock Premium Access
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
