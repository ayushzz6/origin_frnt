'use client';
import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
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
import { getUserTitle } from '@/lib/achievements';
import SocialSettingsCard from '@/components/social/SocialSettingsCard';

interface ProfileProps {
  user: UserType;
  streakData: StreakData;
  onBack: () => void;
  onUpgrade: () => void;
  initialProfileStats?: ProfileStats | null;
  premiumEnabled?: boolean;
  socialEnabled?: boolean;
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

const TABS = [
  { value: 'progress',     icon: TrendingUp, label: 'Progress'  },
  { value: 'photobooth',   icon: Sparkles,   label: 'AI Booth'  },
  { value: 'achievements', icon: Trophy,     label: 'Badges'    },
  { value: 'settings',     icon: Settings,   label: 'Settings'  },
] as const;

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay: 0.05 * i },
});

export default function Profile({
  user,
  streakData,
  onBack,
  onUpgrade,
  initialProfileStats = null,
  premiumEnabled = false,
  socialEnabled = false,
}: ProfileProps) {
  const { refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(initialProfileStats);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar || '');
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['value']>('progress');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    setEditData(userToEditData(user));
    setAvatarUrl(user.avatar || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (initialProfileStats) return;
    apiCall('/users/stats/').then((data: ProfileStats) => setProfileStats(data)).catch(() => {});
  }, [initialProfileStats]);

  const handleCancelEdit = () => {
    setEditData(userToEditData(user));
    setIsEditing(false);
  };

  const handleAvatarFile = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file.'); return; }
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
      toast.error(error instanceof Error ? error.message : 'Could not upload profile picture.');
    } finally {
      URL.revokeObjectURL(previewUrl);
      setIsAvatarUploading(false);
    }
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
      toast.success('Profile changes saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save profile changes.');
    } finally {
      setIsLoading(false);
    }
  };

  const subjectProgress = (profileStats?.subject_progress ?? []).map((s) => ({
    subject: s.subject,
    progress: s.accuracy,
  }));

  const achievements = [
    { name: 'First Test',    description: 'Completed your first test',  icon: BookOpen,   unlocked: profileStats?.achievements.first_test   ?? false },
    { name: '7-Day Streak',  description: 'Studied 7 days in a row',    icon: TrendingUp, unlocked: profileStats?.achievements.streak_7      ?? false },
    { name: 'Doubt Master',  description: 'Solved 50 doubts',           icon: Target,     unlocked: profileStats?.achievements.doubt_master  ?? false },
    { name: 'Top 100',       description: 'Reached top 100 rank',       icon: Trophy,     unlocked: profileStats?.achievements.top_100       ?? false },
    { name: 'Perfect Score', description: 'Scored 100% on a test',      icon: Crown,      unlocked: profileStats?.achievements.perfect_score ?? false },
    { name: '30-Day Streak', description: 'Studied 30 days in a row',   icon: Calendar,   unlocked: profileStats?.achievements.streak_30     ?? false },
  ];

  const STATS = [
    { label: 'Tests Taken',  value: profileStats ? String(profileStats.tests_taken)  : '—', icon: BookOpen,   accent: 'text-primary',    accentBg: 'bg-primary/10'    },
    { label: 'Study Hours',  value: profileStats ? String(profileStats.study_hours)  : '—', icon: Clock,      accent: 'text-emerald-500', accentBg: 'bg-emerald-500/10'},
    { label: 'Day Streak',   value: `${streakData.currentStreak}`,                          icon: TrendingUp, accent: 'text-orange-500',  accentBg: 'bg-orange-500/10' },
    { label: 'Global Rank',  value: profileStats ? (profileStats.global_rank ? `#${profileStats.global_rank}` : '—') : '—', icon: Trophy, accent: 'text-amber-500', accentBg: 'bg-amber-500/10' },
  ];

  const selectCls = 'w-full neu-inset rounded-xl px-3 py-2.5 text-sm font-bold text-foreground bg-transparent outline-none focus:ring-2 focus:ring-primary/30 transition-all';

  /* ── shared avatar block ─────────────────────────────────── */
  const AvatarBlock = (
    <div className="relative mx-auto w-fit">
      <div className="p-1.5 rounded-full neu-raised">
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
        <Avatar className="w-28 h-28 lg:w-32 lg:h-32">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={`${user.name} profile picture`} className="object-cover" /> : null}
          <AvatarFallback className="bg-primary/15 text-primary text-4xl font-black">
            {user.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>
      <button
        type="button"
        disabled={isAvatarUploading}
        onClick={() => avatarInputRef.current?.click()}
        className="absolute -bottom-0.5 -right-0.5 w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 border-2 border-[hsl(var(--neu-bg))] hover:scale-110 transition-transform z-10 disabled:opacity-70"
        aria-label="Upload profile picture"
      >
        {isAvatarUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen neu-surface font-sans">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 pb-20">

        {/* ── Top nav ──────────────────────────────────────────── */}
        <div className="sticky top-0 z-40 py-3">
          <div className="neu-raised flex items-center justify-between px-4 h-12 rounded-2xl">
            <button onClick={onBack} className="p-1.5 rounded-xl text-muted-foreground hover:text-primary transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground">Profile</span>
            <button onClick={() => setActiveTab('settings')} className="p-1.5 rounded-xl text-muted-foreground hover:text-primary transition-colors" title="Settings">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Two-column layout (sidebar + main) ───────────────── */}
        <div className="mt-2 grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr] gap-5 items-start">

          {/* ═══ LEFT SIDEBAR (sticky on desktop) ════════════════ */}
          <div className="lg:sticky lg:top-[72px] flex flex-col gap-4">

            {/* Identity card */}
            <motion.div {...stagger(0)} className="neu-raised p-6 flex flex-col items-center gap-4 text-center">
              {AvatarBlock}

              <div className="w-full space-y-1.5">
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full text-xl font-black tracking-tight neu-inset rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 bg-transparent text-center"
                    placeholder="Your Name"
                    autoFocus
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <h2 className="text-xl font-black tracking-tight text-foreground leading-tight">{displayName}</h2>
                    {user.isPremium && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-600">
                        <Crown className="w-2.5 h-2.5" />Premium
                      </span>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">{user.email}</p>
              </div>

              {/* Info chips */}
              {!isEditing ? (
                <div className="flex flex-wrap justify-center gap-1.5 w-full">
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl neu-inset text-[11px] font-bold text-muted-foreground">
                    <GraduationCap className="w-3 h-3 text-primary shrink-0" />
                    {editData.class === 'dropper' ? 'Dropper' : `Class ${editData.class || 'N/A'}`}
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl neu-inset text-[11px] font-bold text-muted-foreground">
                    <Target className="w-3 h-3 text-primary shrink-0" />
                    {editData.selectedCourse || 'No Course'}
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl neu-inset text-[11px] font-bold text-muted-foreground">
                    <MapPin className="w-3 h-3 text-primary shrink-0" />
                    {editData.location || 'Global'}
                  </span>
                  {(editData.subjects as string[]).map((s) => (
                    <span key={s} className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-primary bg-primary/10 border border-primary/20">
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3 w-full text-left">
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Class</label>
                      <select value={editData.class} onChange={(e) => setEditData({ ...editData, class: e.target.value })} className={selectCls}>
                        <option value="9">Class 9</option>
                        <option value="10">Class 10</option>
                        <option value="11">Class 11</option>
                        <option value="12">Class 12</option>
                        <option value="dropper">Dropper</option>
                      </select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Course</label>
                      <select value={editData.selectedCourse} onChange={(e) => setEditData({ ...editData, selectedCourse: e.target.value })} className={selectCls}>
                        <option value="JEE">JEE</option>
                        <option value="NEET">NEET</option>
                        {['9', '10'].includes(editData.class) && <option value="Foundation">Foundation</option>}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Region / State</label>
                    <select value={editData.location} onChange={(e) => setEditData({ ...editData, location: e.target.value })} className={selectCls}>
                      <option value="">Select Region</option>
                      {INDIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Subjects</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Physics', 'Chemistry', 'Mathematics', 'Biology'].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            const newSubs = editData.subjects.includes(s)
                              ? editData.subjects.filter((x: string) => x !== s)
                              : [...editData.subjects, s];
                            setEditData({ ...editData, subjects: newSubs });
                          }}
                          className={cn(
                            'px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all',
                            editData.subjects.includes(s)
                              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                              : 'neu-btn text-muted-foreground'
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Edit / Save row */}
              <div className="flex gap-2 w-full">
                {isEditing && (
                  <button onClick={handleCancelEdit} className="flex-1 neu-btn h-10 rounded-xl text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  disabled={isLoading}
                  className={cn(
                    'flex-1 h-10 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-60',
                    isEditing
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90'
                      : 'neu-btn text-primary'
                  )}
                >
                  {isEditing ? <><Check className="w-3.5 h-3.5" />Save</> : <><Edit3 className="w-3.5 h-3.5" />Edit Profile</>}
                </button>
              </div>
            </motion.div>

            {/* Stats — vertical on desktop (2×2 grid) */}
            <div className="grid grid-cols-2 gap-3">
              {STATS.map((stat, i) => (
                <motion.div key={stat.label} {...stagger(i + 1)} className="neu-raised p-4 flex flex-col gap-1.5">
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', stat.accentBg)}>
                    <stat.icon className={cn('w-4 h-4', stat.accent)} />
                  </div>
                  <p className={cn('text-2xl font-black leading-none', stat.accent)}>{stat.value}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Footer links */}
            <div className="pt-2 text-center text-[9px] text-muted-foreground/40 space-y-1.5">
              <p>© 2026 SUPERGOAT TECHNOLOGIES PVT. LTD.</p>
              <div className="flex justify-center gap-2 flex-wrap">
                {[
                  { href: '/terms-and-conditions', label: 'Terms' },
                  { href: '/privacy-policy',       label: 'Privacy' },
                  { href: '/faq',                  label: 'FAQ' },
                ].map(({ href, label }) => (
                  <a key={href} href={href} className="hover:text-foreground transition-colors underline underline-offset-2">{label}</a>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ RIGHT MAIN PANEL ════════════════════════════════ */}
          <div className="flex flex-col gap-4 min-w-0">

            {/* Tab bar */}
            <motion.div {...stagger(5)} className="neu-inset rounded-2xl p-1.5 flex gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-200',
                    activeTab === tab.value
                      ? 'neu-raised text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </motion.div>

            {/* Content */}
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>

              {/* Progress */}
              {activeTab === 'progress' && (
                <div className="space-y-4">
                  <div className="neu-raised p-5 sm:p-6 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-primary rounded-full inline-block" />
                      Subject Performance
                    </p>
                    {subjectProgress.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No practice data yet. Start solving questions to see your progress.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {subjectProgress.map((s) => (
                          <div key={s.subject}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-bold text-foreground">{s.subject}</span>
                              <span className="text-sm font-black text-primary">{s.progress}%</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden neu-inset">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${s.progress}%` }}
                                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                                className="h-full rounded-full bg-primary"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="neu-raised p-5 sm:p-6 flex items-center gap-6">
                    <div className="w-24 h-24 relative shrink-0">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/40" />
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
                    <div className="flex-1 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Overall Accuracy</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {(profileStats?.overall_accuracy ?? 0) >= 70
                          ? "You're doing great! Keep pushing higher."
                          : (profileStats?.overall_accuracy ?? 0) > 0
                          ? "Keep practising to improve. You can do it!"
                          : "Start practising to track your performance here."}
                      </p>
                      <button onClick={onBack} className="text-xs font-black text-primary uppercase tracking-wider hover:underline">
                        Continue Learning →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Photobooth */}
              {activeTab === 'photobooth' && <PhotoBooth />}

              {/* Achievements */}
              {activeTab === 'achievements' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {achievements.map((a, i) => (
                    <motion.div
                      key={a.name}
                      {...stagger(i)}
                      className={cn(
                        'neu-raised p-5 text-center flex flex-col items-center gap-2.5',
                        !a.unlocked && 'opacity-40 grayscale'
                      )}
                    >
                      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', a.unlocked ? 'bg-primary/15' : 'bg-muted')}>
                        <a.icon className={cn('w-6 h-6', a.unlocked ? 'text-primary' : 'text-muted-foreground')} />
                      </div>
                      <div>
                        <p className="font-black text-sm text-foreground">{a.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{a.description}</p>
                      </div>
                      {a.unlocked && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />Unlocked
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Settings */}
              {activeTab === 'settings' && (
                <div className="space-y-3">
                  {socialEnabled && (
                    <SocialSettingsCard
                      initialUsername={user.username ?? ''}
                      initialPrivate={Boolean(user.profilePrivate)}
                    />
                  )}
                  {[
                    { icon: User,   label: 'Personal Information', desc: 'Update your name, email, and bio',  accent: 'text-primary',    accentBg: 'bg-primary/10'    },
                    { icon: Bell,   label: 'Notifications',        desc: 'Manage your alert preferences',     accent: 'text-blue-500',   accentBg: 'bg-blue-500/10'   },
                    { icon: Shield, label: 'Privacy & Security',   desc: 'Password, 2FA, and sessions',       accent: 'text-emerald-500',accentBg: 'bg-emerald-500/10'},
                  ].map((item, idx) => (
                    <button key={idx} className="w-full neu-raised neu-pressable flex items-center gap-4 p-4 text-left group">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105', item.accentBg)}>
                        <item.icon className={cn('w-5 h-5', item.accent)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}

                  {premiumEnabled && !user.isPremium && (
                    <div className="neu-raised p-6 bg-primary/5 border border-primary/15 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
                          <Crown className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-black text-base text-foreground">Upgrade to ORIGIN Pro</p>
                          <p className="text-xs text-muted-foreground">Unlock unlimited access</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Unlimited mock tests, deep performance analysis, and priority doubt resolution.
                      </p>
                      <button
                        onClick={onUpgrade}
                        className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-wider shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all"
                      >
                        Unlock Premium Access
                      </button>
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
