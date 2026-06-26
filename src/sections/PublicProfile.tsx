'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Clock,
  TrendingUp,
  Trophy,
  Target,
  Crown,
  Calendar,
  Check,
  Lock,
  MapPin,
  Activity,
  ArrowLeft,
} from 'lucide-react';

import type { PublicProfile as PublicProfileData } from '@/server/social/social-service';
import type { User } from '@/types';
import DailyTracker from '@/components/dashboard/DailyTracker';
import FollowButton from '@/components/social/FollowButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PublicProfileProps {
  initialProfile: PublicProfileData;
}

const ACHIEVEMENT_META = [
  { key: 'first_test', name: 'First Test', description: 'Completed your first test', icon: BookOpen },
  { key: 'streak_7', name: '7-Day Streak', description: 'Studied 7 days in a row', icon: TrendingUp },
  { key: 'doubt_master', name: 'Doubt Master', description: 'Solved 50 doubts', icon: Target },
  { key: 'top_100', name: 'Top 100', description: 'Reached top 100 rank', icon: Trophy },
  { key: 'perfect_score', name: 'Perfect Score', description: 'Scored 100% on a test', icon: Crown },
  { key: 'streak_30', name: '30-Day Streak', description: 'Studied 30 days in a row', icon: Calendar },
] as const;

function formatJoined(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatActivityDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PublicProfile({ initialProfile }: PublicProfileProps) {
  const profile = initialProfile;
  const stats = profile.stats;
  const [followerCount, setFollowerCount] = useState(profile.followerCount);

  // DailyTracker only reads user.contributionData + user.streak.
  const vaultUser = {
    id: profile.id,
    name: profile.name,
    email: '',
    role: 'student',
    streak: stats?.currentStreak ?? 0,
    totalStudyTime: 0,
    joinedAt: new Date(profile.joinedAt),
    isPremium: false,
    isOnboarded: true,
    isDropper: false,
    contributionData: stats?.contributionData ?? [],
  } as User;

  const statCards = stats
    ? [
        { label: 'Tests Taken', value: String(stats.testsTaken), icon: BookOpen, color: 'text-primary', border: 'border-primary/25', bg: 'bg-primary/8' },
        { label: 'Study Hours', value: String(stats.studyHours), icon: Clock, color: 'text-emerald-500', border: 'border-emerald-500/25', bg: 'bg-emerald-500/8' },
        { label: 'Day Streak', value: String(stats.currentStreak), icon: TrendingUp, color: 'text-orange-500', border: 'border-orange-500/25', bg: 'bg-orange-500/8' },
        { label: 'Global Rank', value: stats.globalRank ? `#${stats.globalRank}` : '—', icon: Trophy, color: 'text-amber-500', border: 'border-amber-400/25', bg: 'bg-amber-400/8' },
      ]
    : [];

  return (
    <div className="min-h-screen neu-surface">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Back */}
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>

        {/* Hero */}
        <div className="relative p-6 sm:p-8 rounded-3xl bg-card/60 backdrop-blur-xl border border-border/60 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
            <Avatar className="w-24 h-24 border-[3px] border-background shadow-lg shrink-0">
              {profile.avatar ? (
                <AvatarImage src={profile.avatar} alt={`${profile.name} profile picture`} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white text-3xl font-black">
                {profile.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black tracking-tight truncate">{profile.name}</h1>
              <p className="text-sm font-bold text-primary/80">@{profile.username}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground font-medium">
                {profile.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {profile.location}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Joined {formatJoined(profile.joinedAt)}
                </span>
              </div>

              {/* Counts */}
              <div className="flex items-center gap-5 mt-3">
                <Link href={`/u/${profile.username}/followers`} className="group">
                  <span className="font-black text-foreground">{followerCount}</span>
                  <span className="text-xs text-muted-foreground ml-1 group-hover:text-foreground transition-colors">Followers</span>
                </Link>
                <Link href={`/u/${profile.username}/following`} className="group">
                  <span className="font-black text-foreground">{profile.followingCount}</span>
                  <span className="text-xs text-muted-foreground ml-1 group-hover:text-foreground transition-colors">Following</span>
                </Link>
              </div>
            </div>

            <div className="shrink-0">
              {profile.isMe ? (
                <Button asChild variant="outline" className="font-bold">
                  <Link href="/profile">Edit profile</Link>
                </Button>
              ) : (
                <FollowButton
                  username={profile.username}
                  initialFollowing={profile.isFollowedByMe}
                  followsMe={profile.followsMe}
                  onCountChange={setFollowerCount}
                />
              )}
            </div>
          </div>
        </div>

        {/* Private notice */}
        {!profile.visible ? (
          <div className="flex flex-col items-center text-center gap-3 py-16 rounded-3xl bg-card/40 border border-border/50">
            <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-black text-lg">This profile is private</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              @{profile.username} keeps their activity, rank and badges hidden.
            </p>
          </div>
        ) : (
          stats && (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {statCards.map((stat, i) => (
                  <div
                    key={i}
                    className={cn(
                      'relative p-4 rounded-2xl bg-card/60 backdrop-blur-sm border overflow-hidden hover:scale-[1.02] transition-all',
                      stat.border,
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

              {/* Activity Vault */}
              <DailyTracker user={vaultUser} />

              {/* Recent activity */}
              {stats.recentActivity.length > 0 && (
                <div className="p-5 sm:p-6 rounded-3xl bg-card/60 backdrop-blur-xl border border-border/60">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-primary/15 rounded-xl p-2">
                      <Activity className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-black tracking-tight">Recent Activity</h3>
                  </div>
                  <div className="space-y-2">
                    {stats.recentActivity.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-background/40 border border-border/40"
                      >
                        <span className="text-sm font-semibold truncate">{item.label}</span>
                        <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">
                          {formatActivityDate(item.at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Achievements */}
              <div className="p-5 sm:p-6 rounded-3xl bg-card/60 backdrop-blur-xl border border-border/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-amber-400/15 rounded-xl p-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                  </div>
                  <h3 className="font-black tracking-tight">Badges</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {ACHIEVEMENT_META.map((meta, i) => {
                    const unlocked = Boolean(
                      (stats.achievements as Record<string, boolean>)[meta.key],
                    );
                    return (
                      <div
                        key={i}
                        className={cn(
                          'relative p-5 rounded-2xl border overflow-hidden group transition-all',
                          unlocked
                            ? 'bg-card/80 border-primary/25 hover:border-primary/50 hover:scale-[1.02]'
                            : 'bg-muted/10 border-border/20 opacity-50',
                        )}
                      >
                        {unlocked && (
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                        )}
                        <div className="relative z-10 text-center">
                          <div
                            className={cn(
                              'w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110',
                              unlocked
                                ? 'bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20'
                                : 'bg-secondary',
                            )}
                          >
                            <meta.icon className={cn('w-6 h-6', unlocked ? 'text-white' : 'text-muted-foreground')} />
                          </div>
                          <h4 className="font-black text-sm leading-tight">{meta.name}</h4>
                          <p className="text-[10px] text-muted-foreground mt-1">{meta.description}</p>
                          {unlocked && (
                            <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-wider">
                              <Check className="w-2.5 h-2.5" />UNLOCKED
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
