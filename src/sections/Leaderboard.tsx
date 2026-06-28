'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

const OriMascot = dynamic(() => import('@/features/mascot/Ori2D'), { ssr: false });
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Trophy,
  Flame,
  MapPin,
  Users,
  Globe,
  Crown,
  Medal,
  Award,
  Zap,
  Filter,
  Edit3
} from 'lucide-react';
import { apiCall } from '@/lib/api';
import type { User } from '@/types';
import type { SocialUserCard } from '@/server/social/social-service';
import StudentList from '@/components/social/StudentList';

interface LeaderboardProps {
  currentUser: User;
  /** Pre-loaded by the Server Component for the 'overall' subject */
  initialLeaderboard?: unknown[];
  initialMyRank?: number | null;
  /** Student-social feature flag — enables clickable profiles + the Following tab. */
  socialEnabled?: boolean;
}

import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';

export default function Leaderboard({ currentUser, initialLeaderboard, initialMyRank, socialEnabled }: LeaderboardProps) {
  const { availableWidth } = useLayout();
  const isConstrained = availableWidth < 1024;
  const isMobile = availableWidth < 640;

  const [activeTab, setActiveTab] = useState('global');
  const [followingList, setFollowingList] = useState<SocialUserCard[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [followingLoaded, setFollowingLoaded] = useState(false);

  useEffect(() => {
    if (!socialEnabled || activeTab !== 'friends' || !currentUser?.username || followingLoaded) return;
    let cancelled = false;
    (async () => {
      setFollowingLoading(true);
      try {
        const data = await apiCall(`/social/following/${encodeURIComponent(currentUser?.username ?? '')}`);
        if (!cancelled) setFollowingList(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!cancelled) setFollowingList([]);
      } finally {
        if (!cancelled) {
          setFollowingLoading(false);
          setFollowingLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, socialEnabled, currentUser?.username, followingLoaded]);

  const renderName = (entry: any, className: string) =>
    socialEnabled && entry.username ? (
      <Link href={`/u/${entry.username}`} className={cn(className, 'hover:text-primary transition-colors')}>
        {entry.name}
      </Link>
    ) : (
      <span className={className}>{entry.name}</span>
    );

  const [selectedSubject, setSelectedSubject] = useState<string>('overall');
  const [leaderboard, setLeaderboard] = useState<any[]>((initialLeaderboard as any[]) ?? []);
  const [myRank, setMyRank] = useState<number | null>(initialMyRank ?? null);
  const [isLoading, setIsLoading] = useState(!initialLeaderboard);
  const skipInitialFetch = useRef(!!initialLeaderboard);

  useEffect(() => {
    if (skipInitialFetch.current && selectedSubject === 'overall') {
      skipInitialFetch.current = false;
      if (activeTab === 'global') return;
    }
    if (activeTab === 'local' && !currentUser?.location) {
      setLeaderboard([]);
      setMyRank(null);
      return;
    }
    fetchLeaderboard();
  }, [selectedSubject, activeTab, currentUser?.location]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSubject !== 'overall') params.append('subject', selectedSubject);
      if (activeTab === 'local' && currentUser?.location) {
        params.append('location', currentUser?.location);
      }
      const url = `/assessments/ogcode/leaderboard/?${params.toString()}`;
      const data = await apiCall(url);
      setLeaderboard(data.leaderboard || []);
      setMyRank(data.myRank);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className={cn(isMobile ? "w-4 h-4" : "w-5 h-5", "text-amber-500")} />;
    if (rank === 2) return <Medal className={cn(isMobile ? "w-4 h-4" : "w-5 h-5", "text-slate-400")} />;
    if (rank === 3) return <Award className={cn(isMobile ? "w-4 h-4" : "w-5 h-5", "text-orange-500")} />;
    return <span className={cn(isMobile ? "text-sm" : "text-base", "w-5 h-5 flex items-center justify-center font-medium text-muted-foreground")}>{rank}</span>;
  };

  const myEntry = leaderboard.find(e => e.isMe);
  const myScore = myEntry ? myEntry.rankScore : 0;

  const LeaderboardRow = ({ entry }: { entry: any }) => (
    <div
      key={entry.userId}
      className={cn(
        "flex items-center rounded-2xl transition-all duration-300",
        isMobile ? "gap-3 p-4" : "gap-5 p-5",
        entry.isMe
          ? 'neu-raised ring-1 ring-primary/30'
          : 'neu-inset hover:neu-raised hover:-translate-y-0.5'
      )}
    >
      <div className={cn(
        "flex justify-center font-black tracking-tighter shrink-0",
        isMobile ? "w-6 text-lg" : "w-10 text-xl"
      )}>
        {getRankIcon(entry.rank)}
      </div>

      <Avatar className={cn(
        "shadow-lg ring-2 ring-background border-2 border-transparent shrink-0",
        isMobile ? "w-10 h-10" : "w-14 h-14"
      )}>
        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white font-black text-lg">
          {entry.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          {renderName(entry, cn("font-black tracking-tight truncate", isMobile ? "text-sm" : "text-lg"))}
          {entry.isMe && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">YOU</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1 font-black uppercase tracking-widest opacity-60">
          <span className={isMobile ? "hidden" : "block"}>Efficiency: {(entry.rankScore ?? 0).toFixed(1)}%</span>
          {!isMobile && <span className="w-1 h-1 rounded-full bg-border" />}
          <span>{entry.questionsSolved || 0} Questions Solved</span>
        </div>
      </div>

      <div className="text-right flex items-center gap-4 sm:gap-8 shrink-0">
        {!isMobile && (
          <div className="hidden sm:block text-right">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Study Time</p>
            <div className="flex items-center gap-1.5 justify-end">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-sm font-black">{entry.studyTime || 0}m</span>
            </div>
          </div>
        )}
        <div className="text-right">
          <p className={cn("font-black text-primary leading-none tracking-tighter", isMobile ? "text-xl" : "text-3xl")}>{entry.score || 0}</p>
          <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest mt-1">XP Points</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen neu-surface text-foreground transition-colors duration-500 overflow-x-hidden">
      <main className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-10 relative z-10">
        {/* Hero card — gradient accent, kept intentionally */}
        <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground mb-8 overflow-hidden relative rounded-[2.5rem] shadow-[8px_8px_24px_hsl(var(--neu-shadow)),_-4px_-4px_16px_hsl(var(--neu-light))]">
          <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] mix-blend-overlay pointer-events-none" />
          <div className={cn("relative z-10", isMobile ? "p-6" : "p-8 sm:p-10")}>
            <div className={cn(
              "flex items-center justify-between gap-6",
              isMobile ? "flex-col" : "flex-row"
            )}>
              <div className="flex items-center gap-6">
                <div className={cn(
                  "rounded-3xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-md shadow-xl",
                  isMobile ? "w-16 h-16" : "w-20 h-20"
                )}>
                  <span className={cn("font-black", isMobile ? "text-2xl" : "text-3xl")}>#{myRank || ' - '}</span>
                </div>
                <div>
                  <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Global Standing</p>
                  <p className={cn("font-black tracking-tight leading-none mb-2", isMobile ? "text-xl" : "text-2xl")}>{currentUser?.name}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-xs font-bold">{currentUser?.streak} Day Streak</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={cn("text-center", isMobile ? "" : "sm:text-right")}>
                <p className={cn("font-black tracking-tighter drop-shadow-md", isMobile ? "text-4xl" : "text-5xl")}>{(myScore ?? 0).toFixed(1)}%</p>
                <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em]">Efficiency Rating</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 px-2">
          <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight">
            <div className="h-12 w-12 shrink-0">
              <OriMascot expression="thumbsup" title="Origin AI" />
            </div>
            <div className="w-2 h-8 bg-primary rounded-full" />
            Hall of Fame
          </h2>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-full sm:w-[200px] neu-raised border-0 rounded-2xl font-bold h-12">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                <SelectValue placeholder="All Subjects" />
              </div>
            </SelectTrigger>
            <SelectContent className="neu-raised border-0 rounded-2xl p-1">
              <SelectItem value="overall" className="rounded-xl font-medium focus:bg-primary/10">Global Combined</SelectItem>
              <SelectItem value="physics" className="rounded-xl font-medium focus:bg-primary/10">Physics Arena</SelectItem>
              <SelectItem value="chemistry" className="rounded-xl font-medium focus:bg-primary/10">Chemistry Arena</SelectItem>
              <SelectItem value="mathematics" className="rounded-xl font-medium focus:bg-primary/10">Mathematics Arena</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-12">
          <TabsList className="neu-inset p-1.5 w-full h-16 rounded-[2rem] border-0 bg-transparent">
            <TabsTrigger
              value="global"
              className="flex-1 h-full rounded-[1.5rem] data-[state=active]:neu-raised data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground font-black text-xs uppercase tracking-widest transition-all gap-2"
            >
              <Globe className="w-4 h-4" />
              Global
            </TabsTrigger>
            <TabsTrigger
              value="local"
              className="flex-1 h-full rounded-[1.5rem] data-[state=active]:neu-raised data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground font-black text-xs uppercase tracking-widest transition-all gap-2"
            >
              <MapPin className="w-4 h-4" />
              Regional
            </TabsTrigger>
            <TabsTrigger
              value="friends"
              className="flex-1 h-full rounded-[1.5rem] data-[state=active]:neu-raised data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground font-black text-xs uppercase tracking-widest transition-all gap-2"
            >
              <Users className="w-4 h-4" />
              {socialEnabled ? 'Following' : 'Circle'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Top 3 Podium */}
            <div className={cn(
              "flex justify-center items-end mt-8 mb-16",
              isMobile ? "gap-2" : "gap-3 sm:gap-6"
            )}>
              {leaderboard.slice(0, 3).map((entry, index) => (
                <div
                  key={entry.userId}
                  className={cn(
                    "flex flex-col items-center flex-1 group",
                    isMobile ? "max-w-[100px]" : "max-w-[140px]",
                    index === 0 ? 'order-2 scale-110 -translate-y-4' : index === 1 ? 'order-1' : 'order-3'
                  )}
                >
                  <div className="relative">
                    <motion.div
                      className={`absolute -inset-2 bg-gradient-to-br opacity-20 blur-xl rounded-full ${
                        index === 0 ? 'from-amber-400 to-yellow-500' :
                        index === 1 ? 'from-slate-400 to-slate-200' :
                        'from-orange-500 to-orange-300'
                      }`}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 4, repeat: Infinity }}
                    />
                    <Avatar className={cn(
                      "border-[6px] shadow-2xl relative z-10",
                      isMobile ? "w-16 h-16 border-[4px]" : "w-20 h-20 sm:w-28 sm:h-28",
                      index === 0 ? 'border-amber-400' :
                      index === 1 ? 'border-slate-300' :
                      'border-orange-500'
                    )}>
                      <AvatarFallback className={cn(
                        "font-black",
                        isMobile ? "text-xl" : "text-2xl sm:text-3xl",
                        index === 0 ? 'bg-amber-100 text-amber-600' :
                        index === 1 ? 'bg-muted text-muted-foreground' :
                        'bg-orange-100 text-orange-600'
                      )}>
                        {(entry.name.charAt(0)).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full flex items-center justify-center shadow-2xl ring-4 ring-background z-20",
                      isMobile ? "w-7 h-7 ring-2" : "w-10 h-10",
                      index === 0 ? 'bg-amber-400' :
                      index === 1 ? 'bg-slate-300' :
                      'bg-orange-500'
                    )}>
                      <span className={cn(
                        "font-black",
                        isMobile ? "text-xs" : "text-base",
                        index === 0 ? "text-amber-950" : index === 1 ? "text-slate-900" : "text-white"
                      )}>{index + 1}</span>
                    </div>
                  </div>
                  <p className={cn(
                    "font-black mt-8 tracking-tight truncate w-full text-center group-hover:text-primary transition-colors",
                    index === 0 ? (isMobile ? 'text-sm' : 'text-lg') : 'text-xs'
                  )}>
                    {entry.name}
                  </p>
                  <p className="text-[10px] font-black text-primary/80 mt-1">
                    {(entry.rankScore ?? 0).toFixed(1)}% Efficiency
                  </p>
                </div>
              ))}
            </div>

            {/* Leaderboard List */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-6">
                  <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-muted-foreground font-black uppercase text-xs tracking-[0.3em] animate-pulse">Syncing Arena Rankings</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-24 neu-inset rounded-[3rem]">
                  <Trophy className="w-16 h-16 text-muted-foreground/20 mx-auto mb-6" />
                  <p className="text-muted-foreground font-black uppercase text-xs tracking-widest">No rankings detected</p>
                </div>
              ) : leaderboard.map((entry) => (
                <LeaderboardRow key={entry.userId} entry={entry} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="local" className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {!currentUser?.location ? (
              <div className="neu-raised rounded-2xl p-12 text-center">
                <div className="w-20 h-20 mx-auto neu-inset rounded-3xl flex items-center justify-center mb-6">
                  <MapPin className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-black tracking-tight mb-2">Location Required</h3>
                <p className="text-muted-foreground mb-8 max-w-sm mx-auto font-medium leading-relaxed">
                  Please set your Region/State in your profile to view the regional leaderboard.
                </p>
                <Link href="/profile">
                  <button className="rounded-xl px-8 h-12 bg-primary text-primary-foreground font-black hover:-translate-y-0.5 transition-all shadow-[3px_3px_8px_hsl(var(--neu-shadow))] inline-flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Set Location in Profile
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-4 mb-6">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-[0.2em]">
                      <MapPin className="w-3.5 h-3.5" />
                      Current Region
                    </div>
                    <div className="text-xl font-black tracking-tight">{currentUser?.location}</div>
                  </div>
                  <Link href="/profile">
                    <button className="neu-raised rounded-xl px-3 py-2 font-bold text-xs flex items-center gap-2 hover:-translate-y-0.5 transition-all">
                      <Edit3 className="w-3.5 h-3.5" />
                      Update Region
                    </button>
                  </Link>
                </div>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-6">
                    <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-muted-foreground font-black uppercase text-xs tracking-[0.3em] animate-pulse">Syncing Regional Rankings</p>
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-24 neu-inset rounded-[3rem]">
                    <Trophy className="w-16 h-16 text-muted-foreground/20 mx-auto mb-6" />
                    <p className="text-muted-foreground font-black uppercase text-xs tracking-widest">No rankings detected in this region</p>
                  </div>
                ) : leaderboard.map((entry) => (
                  <LeaderboardRow key={entry.userId} entry={entry} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="friends" className="mt-8">
            {socialEnabled ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-[0.2em]">
                    <Users className="w-3.5 h-3.5" />
                    People you follow
                  </div>
                  <Link href="/social">
                    <button className="neu-raised rounded-xl px-3 py-2 font-bold text-xs flex items-center gap-2 hover:-translate-y-0.5 transition-all">
                      <Users className="w-3.5 h-3.5" />
                      Find students
                    </button>
                  </Link>
                </div>
                {followingLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-6">
                    <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-muted-foreground font-black uppercase text-xs tracking-[0.3em] animate-pulse">Loading your circle</p>
                  </div>
                ) : (
                  <StudentList
                    users={followingList}
                    emptyLabel="You're not following anyone yet — tap 'Find students' to get started."
                  />
                )}
              </div>
            ) : (
              <div className="neu-raised rounded-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center">
                  <span className="mb-4 inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary">COMING SOON</span>
                  <h3 className="text-xl font-black mb-2">Social Circles</h3>
                  <p className="text-sm text-muted-foreground max-w-[280px]">Challenge your friends and build a community for collective growth.</p>
                </div>
                <div className="p-12 text-center opacity-20 grayscale">
                  <div className="w-20 h-20 mx-auto neu-inset rounded-3xl flex items-center justify-center mb-6">
                    <Users className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-black tracking-tight mb-2">Social Circle</h3>
                  <p className="text-muted-foreground mb-8 max-w-sm mx-auto font-medium leading-relaxed">
                    Competing with friends increases learning efficiency by 40%. Start your journey together.
                  </p>
                  <button disabled className="rounded-xl px-8 h-12 bg-primary text-primary-foreground font-black opacity-50 cursor-not-allowed inline-flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Invite Friends
                  </button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
