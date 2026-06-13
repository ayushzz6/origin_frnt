'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Sparkles,
  MapPin,
  RefreshCw,
  Check,
  ChevronRight,
} from 'lucide-react';
import { apiCall } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { updateProfileAction, uploadUserImageAction } from '@/server/actions/profile-actions';
import type { User as UserType, StreakData } from '@/types';
import PhotoBooth from '@/components/profile/PhotoBooth';
import { INDIAN_STATES } from '@/lib/constants';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProfileProps {
  user: UserType;
  streakData: StreakData;
  onBack: () => void;
  onUpgrade: () => void;
  initialProfileStats?: ProfileStats | null;
  premiumEnabled?: boolean;
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
  premiumEnabled = false,
}: ProfileProps) {
  const { refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(initialProfileStats);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar || '');
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('progress');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const title = getUserTitle(user);
  const displayName = title ? `${title} ${user.name}` : user.name;

  const userToEditData = (profile: UserType) => ({
    name: profile.name,
    class: profile.class || '',
    selectedCourse: profile.selectedCourse || '',
    subjects: profile.subjects || [],
    location: profile.location || '',
  });

  const [editData, setEditData] = useState(() => userToEditData(user));

  const resetEditData = () => {
    setEditData(userToEditData(user));
  };

  const handleCancelEdit = () => {
    resetEditData();
    setIsEditing(false);
  };

  const handleAvatarFile = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }

    setIsAvatarUploading(true);
    const previousAvatar = avatarUrl;
    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);
    try {
      const formData = new FormData();
      formData.set('purpose', 'profile_avatar');
      formData.set('file', file);
      const uploaded = await uploadUserImageAction(formData);
      setAvatarUrl(uploaded.url);
      await refreshUser();
      toast.success('Profile picture updated.');
    } catch (error) {
      setAvatarUrl(previousAvatar);
      const message = error instanceof Error ? error.message : 'Could not upload profile picture.';
      toast.error(message);
    } finally {
      URL.revokeObjectURL(previewUrl);
      setIsAvatarUploading(false);
    }
  };

  useEffect(() => {
    setEditData(userToEditData(user));
    setAvatarUrl(user.avatar || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialProfileStats) {
      return;
    }
    apiCall('/users/stats/').then((data: ProfileStats) => setProfileStats(data)).catch(() => {});
  }, [initialProfileStats]);

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
      toast.success('Profile changes saved.');
    } catch (error) {
      console.error('Failed to update profile:', error);
      const message = error instanceof Error ? error.message : 'Could not save profile changes.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const subjectProgress = (profileStats?.subject_progress ?? []).map((s) => ({
    subject: s.subject,
    progress: s.accuracy,
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
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      {/* Futuristic ambient background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/4 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/4 rounded-full blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 59px,currentColor 59px,currentColor 60px),repeating-linear-gradient(90deg,transparent,transparent 59px,currentColor 59px,currentColor 60px)'
        }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-2xl border-b border-border/40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              <button
                onClick={onBack}
                className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-[11px] font-black tracking-[0.2em] uppercase text-muted-foreground/60">Profile</span>
              <button
                onClick={() => setActiveTab('settings')}
                className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                title="Go to settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 w-full pb-20">
          {/* Hero card */}
          <div className="relative mt-6 mb-6 p-6 sm:p-8 rounded-3xl bg-card/70 backdrop-blur-xl border border-border/60 shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/8 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-2xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 relative z-10">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="absolute -inset-[3px] rounded-full bg-gradient-to-tr from-primary/80 via-primary/40 to-transparent" />
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = '';
                    await handleAvatarFile(file);
                  }}
                />
                <Avatar className="relative w-24 h-24 border-[3px] border-background z-10">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={`${user.name} profile picture`} className="object-cover" /> : null}
                  <AvatarFallback className="bg-primary text-white text-3xl font-black">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  disabled={isAvatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 border-2 border-background hover:scale-110 transition-transform z-20 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
                  aria-label="Upload profile picture"
                >
                  {isAvatarUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 text-center sm:text-left">
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="text-2xl sm:text-3xl font-black tracking-tight bg-transparent border-b-2 border-primary/30 focus:border-primary outline-none w-full sm:max-w-sm mb-3"
                    placeholder="Your Name"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center justify-center sm:justify-start gap-3 mb-1.5 flex-wrap">
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{displayName}</h2>
                    {user.isPremium && (
                      <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 shadow-md shadow-orange-500/20 text-[9px] px-2.5 h-5">
                        <Crown className="w-2.5 h-2.5 mr-1" />PREMIUM
                      </Badge>
                    )}
                  </div>
                )}
                <p className="text-sm text-muted-foreground mb-4">{user.email}</p>

                {isEditing ? (
                  <div className="flex flex-col gap-3 w-full max-w-sm">
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">Class</label>
                        <select
                          value={editData.class}
                          onChange={(e) => setEditData({ ...editData, class: e.target.value })}
                          className="w-full bg-secondary/60 border border-border rounded-xl px-3 py-2 text-sm font-bold"
                        >
                          <option value="9">Class 9</option>
                          <option value="10">Class 10</option>
                          <option value="11">Class 11</option>
                          <option value="12">Class 12</option>
                          <option value="dropper">Dropper</option>
                        </select>
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">Course</label>
                        <select
                          value={editData.selectedCourse}
                          onChange={(e) => setEditData({ ...editData, selectedCourse: e.target.value })}
                          className="w-full bg-secondary/60 border border-border rounded-xl px-3 py-2 text-sm font-bold"
                        >
                          <option value="JEE">JEE</option>
                          <option value="NEET">NEET</option>
                          {['9', '10'].includes(editData.class) && (
                            <option value="Foundation">Foundation</option>
                          )}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">Region / State</label>
                      <select
                        value={editData.location}
                        onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                        className="w-full bg-secondary/60 border border-border rounded-xl px-3 py-2 text-sm font-bold"
                      >
                        <option value="">Select Region</option>
                        {INDIAN_STATES.map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">Subjects</label>
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
                            className={cn(
                              'cursor-pointer px-3 py-1.5 h-auto text-[10px] font-black uppercase tracking-wider rounded-lg transition-all border-0',
                              editData.subjects.includes(s)
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                            )}
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 text-xs font-bold text-muted-foreground">
                      <GraduationCap className="w-3 h-3 text-primary" />
                      Class {editData.class === 'dropper' ? 'Dropper' : (editData.class || 'Not Set')}
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 text-xs font-bold text-muted-foreground">
                      <Target className="w-3 h-3 text-primary" />
                      {editData.selectedCourse || 'No Course'}
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 text-xs font-bold text-muted-foreground">
                      <MapPin className="w-3 h-3 text-primary" />
                      {editData.location || 'Global'}
                    </div>
                    {editData.subjects.map((s: string) => (
                      <div key={s} className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Edit / Save */}
              <div className="flex flex-col gap-2 flex-shrink-0">
                <Button
                  variant={isEditing ? 'default' : 'outline'}
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  disabled={isLoading}
                  className={cn(
                    'rounded-xl h-10 px-5 font-bold text-sm gap-1.5',
                    isEditing ? 'bg-primary hover:bg-primary/90 shadow-md shadow-primary/20' : 'border-border/70'
                  )}
                >
                  {isEditing
                    ? <><Check className="w-4 h-4" />Save</>
                    : <><Edit3 className="w-4 h-4" />Edit</>
                  }
                </Button>
                {isEditing && (
                  <Button variant="ghost" onClick={handleCancelEdit} className="text-xs text-muted-foreground h-8">
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Tests Taken', value: profileStats ? String(profileStats.tests_taken) : '—', icon: BookOpen, color: 'text-primary', border: 'border-primary/25', bg: 'bg-primary/8' },
              { label: 'Study Hours', value: profileStats ? String(profileStats.study_hours) : '—', icon: Clock, color: 'text-emerald-500', border: 'border-emerald-500/25', bg: 'bg-emerald-500/8' },
              { label: 'Day Streak', value: `${streakData.currentStreak}`, icon: TrendingUp, color: 'text-orange-500', border: 'border-orange-500/25', bg: 'bg-orange-500/8' },
              { label: 'Global Rank', value: profileStats ? (profileStats.global_rank ? `#${profileStats.global_rank}` : '—') : '—', icon: Trophy, color: 'text-amber-500', border: 'border-amber-400/25', bg: 'bg-amber-400/8' },
            ].map((stat, i) => (
              <div
                key={i}
                className={cn(
                  'relative p-4 rounded-2xl bg-card/60 backdrop-blur-sm border overflow-hidden hover:scale-[1.02] transition-all cursor-default',
                  stat.border
                )}
              >
                <div className={cn('absolute inset-0', stat.bg)} />
                <div className="relative z-10">
                  <div className={cn('w-8 h-8 rounded-xl bg-background/60 flex items-center justify-center mb-2.5', stat.color)}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                  <p className={cn('text-2xl font-black leading-none', stat.color)}>{stat.value}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-secondary/30 border border-border/40 p-1 w-full h-11 rounded-2xl backdrop-blur-sm mb-6">
              {[
                { value: 'progress', icon: TrendingUp, label: 'Progress' },
                { value: 'photobooth', icon: Sparkles, label: 'AI Booth' },
                { value: 'achievements', icon: Trophy, label: 'Badges' },
                { value: 'settings', icon: Settings, label: 'Settings' },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex-1 h-full rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md text-muted-foreground font-bold text-[11px] sm:text-xs tracking-tight transition-all gap-1.5"
                >
                  <tab.icon className="w-3.5 h-3.5 hidden sm:block" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="progress">
              <div className="space-y-5">
                <div className="p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-5 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-primary rounded-full inline-block" />
                    Subject Performance
                  </h3>
                  <div className="space-y-5">
                    {subjectProgress.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No practice data yet. Start solving questions to see your progress.
                      </p>
                    )}
                    {subjectProgress.map((subject) => (
                      <div key={subject.subject}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-bold">{subject.subject}</span>
                          <span className="text-sm font-black text-primary">{subject.progress}%</span>
                        </div>
                        <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-700"
                            style={{ width: `${subject.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/20 backdrop-blur-sm">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-5 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-primary rounded-full inline-block" />
                    Overall Accuracy
                  </h3>
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 relative flex-shrink-0">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-secondary" />
                        <circle
                          cx="40" cy="40" r="34" fill="none"
                          stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round"
                          strokeDasharray={`${((profileStats?.overall_accuracy ?? 0) / 100) * 213.6} 213.6`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-black text-primary">{profileStats?.overall_accuracy ?? 0}%</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {(profileStats?.overall_accuracy ?? 0) >= 70
                          ? "You're doing great! Keep pushing your accuracy higher."
                          : (profileStats?.overall_accuracy ?? 0) > 0
                          ? "Keep practicing to improve your accuracy. You can do it!"
                          : "Start practicing questions to track your performance here."}
                      </p>
                      <Button
                        variant="ghost"
                        className="text-primary p-0 h-auto mt-2 text-sm font-bold hover:bg-transparent"
                        onClick={onBack}
                      >
                        Continue Learning →
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="photobooth">
              <PhotoBooth />
            </TabsContent>

            <TabsContent value="achievements">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {achievements.map((achievement, i) => (
                  <div
                    key={i}
                    className={cn(
                      'relative p-5 rounded-2xl border overflow-hidden group transition-all',
                      achievement.unlocked
                        ? 'bg-card/80 border-primary/25 hover:border-primary/50 hover:scale-[1.02]'
                        : 'bg-muted/10 border-border/20 opacity-50'
                    )}
                  >
                    {achievement.unlocked && (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                    )}
                    <div className="relative z-10 text-center">
                      <div className={cn(
                        'w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110',
                        achievement.unlocked
                          ? 'bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20'
                          : 'bg-secondary'
                      )}>
                        <achievement.icon className={cn('w-6 h-6', achievement.unlocked ? 'text-white' : 'text-muted-foreground')} />
                      </div>
                      <h4 className="font-black text-sm leading-tight">{achievement.name}</h4>
                      <p className="text-[10px] text-muted-foreground mt-1">{achievement.description}</p>
                      {achievement.unlocked && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-wider">
                          <Check className="w-2.5 h-2.5" />UNLOCKED
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="space-y-2.5">
                {[
                  { icon: User, label: 'Personal Information', desc: 'Update your name, email, and bio', iconBg: 'bg-primary/10', iconColor: 'text-primary' },
                  { icon: Bell, label: 'Notifications', desc: 'Manage your alert preferences', iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500' },
                  { icon: Shield, label: 'Privacy & Security', desc: 'Password, 2FA, and sessions', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-secondary/40 transition-all border border-transparent hover:border-border/40 group text-left"
                  >
                    <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105', item.iconBg, item.iconColor)}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm">{item.label}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </button>
                ))}

                {premiumEnabled && !user.isPremium && (
                  <div className="mt-2 p-6 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground relative overflow-hidden shadow-xl shadow-primary/20">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                      <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <Crown className="w-5 h-5 text-amber-300" />
                      </div>
                      <h4 className="font-black text-base tracking-tight">Upgrade to ORIGIN Pro</h4>
                    </div>
                    <p className="text-primary-foreground/75 text-xs mb-4 relative z-10 leading-relaxed">
                      Unlock unlimited mock tests, deep performance analysis, and priority doubt resolution.
                    </p>
                    <Button
                      onClick={onUpgrade}
                      className="w-full bg-background text-primary hover:bg-background/90 font-black h-10 rounded-xl shadow-md relative z-10"
                    >
                      Unlock Premium Access
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="mt-10 text-center text-[11px] text-muted-foreground/60 border-t border-border/30 pt-6">
            <p className="mb-2">© 2026 SUPERGOAT TECHNOLOGIES PRIVATE LIMITED. All rights reserved.</p>
            <div className="flex justify-center gap-4 flex-wrap">
              <a href="/terms-and-conditions" className="underline hover:text-foreground transition-colors">Terms and Conditions</a>
              <span>•</span>
              <a href="/privacy-policy" className="underline hover:text-foreground transition-colors">Privacy Policy</a>
              <span>•</span>
              <a href="/childrens-policy" className="underline hover:text-foreground transition-colors">Children&apos;s Safety Policy</a>
              <span>•</span>
              <a href="/faq" className="underline hover:text-foreground transition-colors">FAQ</a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
