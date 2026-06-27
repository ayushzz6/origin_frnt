'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Search,
  UserPlus,
  Flame,
  Target,
  Trophy,
  Users,
  CheckCircle2,
  Sparkles,
  Loader2,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { apiCall } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import FollowButton from '@/components/social/FollowButton';
import type { PopularStudents, PopularUserCard, PopularTab, SocialUserCard } from '@/server/social/social-service';

const TABS: { key: PopularTab; label: string; icon: typeof Trophy }[] = [
  { key: 'followed', label: 'Most Followed', icon: Users },
  { key: 'ranked', label: 'Top Ranked', icon: Trophy },
  { key: 'active', label: 'Most Active', icon: Zap },
];

/** Exam/class badge colours, matching the source design's nebula accents. */
function badgeClasses(badge: string): string {
  switch (badge) {
    case 'JEE Advanced':
      return 'bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/30';
    case 'JEE Main':
      return 'bg-violet-500/15 text-violet-500 dark:text-violet-400 border-violet-500/30';
    case 'NEET':
      return 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/30';
    case 'Class 12':
      return 'bg-pink-500/15 text-pink-500 dark:text-pink-400 border-pink-500/30';
    case 'Class 11':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    case 'Dropper':
      return 'bg-orange-500/15 text-orange-500 dark:text-orange-400 border-orange-500/30';
    default:
      return 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border-slate-500/30';
  }
}

function hasStats(c: PopularUserCard): boolean {
  return c.rank !== null || c.streak > 0 || c.accuracy > 0;
}

export default function SocialDashboard({
  data,
  viewerName,
  viewerUsername,
}: {
  data: PopularStudents;
  viewerName: string;
  viewerUsername: string | null;
}) {
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';

  // Clicking a row opens the student in the side preview. Below `xl` there is no
  // side panel, so fall back to opening their full profile page.
  const openRow = (c: PopularUserCard) => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches) {
      setSelectedId(c.id);
    } else {
      router.push(`/u/${c.username}`);
    }
  };

  const [tab, setTab] = useState<PopularTab>('followed');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PopularUserCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Debounced search → reuse GET /api/social/search, lift plain cards into the
  // rich card shape (stats absent → stat row hides itself).
  useEffect(() => {
    const term = query.trim();
    if (term.length < 1) {
      setResults([]);
      setSearching(false);
      setSearched(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await apiCall(`/social/search?q=${encodeURIComponent(term)}`);
        const raw: SocialUserCard[] = Array.isArray(res?.results) ? res.results : [];
        setResults(raw.map((u) => ({
          ...u,
          streak: 0, accuracy: 0, rank: null, tests: 0, followerCount: 0, badge: null,
        })));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
        setSearched(true);
      }
    }, 280);
    return () => clearTimeout(handle);
  }, [query]);

  const isSearchMode = query.trim().length > 0;
  const list = useMemo(
    () => (isSearchMode ? results : data[tab]),
    [isSearchMode, results, data, tab],
  );

  // Keep a valid selection for the profile preview as the list changes.
  const selected = useMemo(
    () => list.find((c) => c.id === selectedId) ?? list[0] ?? null,
    [list, selectedId],
  );

  // Search results arrive without stats. For the preview, pull the selected
  // student's authoritative stats (the same snapshot that powers their own
  // /profile) on demand, so nothing in the preview is a placeholder.
  const [statsCache, setStatsCache] = useState<Record<string, {
    tests: number; accuracy: number; rank: number | null; streak: number;
  }>>({});

  useEffect(() => {
    if (!selected || hasStats(selected)) return;
    const uname = selected.username;
    if (statsCache[uname]) return;
    let cancelled = false;
    (async () => {
      try {
        const prof = await apiCall(`/social/profile/${encodeURIComponent(uname)}`);
        if (cancelled || !prof?.stats) return;
        setStatsCache((prev) => ({
          ...prev,
          [uname]: {
            tests: prof.stats.testsTaken ?? 0,
            accuracy: prof.stats.overallAccuracy ?? 0,
            rank: prof.stats.globalRank ?? null,
            streak: prof.stats.currentStreak ?? 0,
          },
        }));
      } catch {
        // Leave the card's own (zeroed) values — better than showing wrong data.
      }
    })();
    return () => { cancelled = true; };
  }, [selected, statsCache]);

  // Real stats for the preview: card stats for popular students (already real),
  // fetched stats for searched students whose card had none.
  const preview = useMemo(() => {
    if (!selected) return null;
    const fetched = !hasStats(selected) ? statsCache[selected.username] : undefined;
    return {
      tests: fetched?.tests ?? selected.tests,
      accuracy: fetched?.accuracy ?? selected.accuracy,
      rank: fetched?.rank ?? selected.rank,
      streak: fetched?.streak ?? selected.streak,
    };
  }, [selected, statsCache]);

  const panel = isDark
    ? 'border border-white/10 bg-white/[0.04] backdrop-blur-xl'
    : 'neu-raised border border-transparent';

  const copyInvite = async () => {
    if (!viewerUsername) {
      toast.info('Set a username in your profile to share an invite link.');
      return;
    }
    try {
      const url = `${window.location.origin}/u/${viewerUsername}`;
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied to clipboard.');
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  return (
    <div className={cn('min-h-screen text-foreground', isDark ? 'social-nebula' : 'neu-surface')}>
      <style>{`
        .social-nebula {
          background-color: #060B19;
          background-image:
            radial-gradient(60% 50% at 80% 0%, rgba(59,130,246,0.12), transparent 70%),
            radial-gradient(50% 40% at 0% 100%, rgba(14,165,233,0.10), transparent 70%);
        }
        .social-glow { box-shadow: 0 0 18px rgba(59,130,246,0.28); }
        @keyframes social-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .social-float { animation: social-float 4.5s ease-in-out infinite; }
      `}</style>

      <div className="mx-auto flex max-w-7xl gap-6 px-3 sm:px-6 lg:px-8 py-5 sm:py-7">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Header */}
          <header className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl p-1.5',
                isDark ? 'border border-primary/30 bg-white/5 social-glow' : 'neu-raised',
              )}>
                <img src="/ori2d/ori-cheerful.png" alt="" draggable={false} className="h-full w-full object-contain social-float select-none" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Find students</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Hey {viewerName.split(' ')[0]} — search, follow, and learn together.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={copyInvite}
              className={cn(
                'hidden sm:flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all',
                isDark
                  ? 'border border-primary/40 text-primary hover:bg-primary/10'
                  : 'neu-raised text-primary hover:-translate-y-0.5',
              )}
            >
              <UserPlus className="h-4 w-4" />
              Invite friends
            </button>
          </header>

          {/* Search */}
          <div className={cn('mb-5 flex items-center gap-3 rounded-2xl px-4 h-12', panel)}>
            <Search className="h-4 w-4 shrink-0 text-primary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students by @username or name…"
              className="h-full flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50"
            />
            {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
          </div>

          {/* Tabs (hidden while searching) */}
          {!isSearchMode && (
            <div className="mb-5 flex gap-1 border-b border-border/60">
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { setTab(t.key); setSelectedId(null); }}
                    className={cn(
                      'relative flex items-center gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-bold transition-colors -mb-px',
                      active
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <t.icon className="h-4 w-4" />
                    {t.label}
                    {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* List */}
          <div className="space-y-3">
            {list.map((c) => {
              const isSelected = selected?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => openRow(c)}
                  className={cn(
                    'group flex cursor-pointer items-center gap-4 rounded-xl p-3.5 sm:p-4 transition-all',
                    panel,
                    isSelected
                      ? isDark
                        ? 'border-primary/40 social-glow'
                        : '-translate-y-0.5 ring-2 ring-primary/30'
                      : isDark
                        ? 'hover:border-primary/30'
                        : 'hover:-translate-y-0.5',
                  )}
                >
                  {/* Identity */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar className="h-12 w-12 shrink-0 ring-2 ring-primary/15">
                      {c.avatar ? <AvatarImage src={c.avatar} alt={c.name} className="object-cover" /> : null}
                      <AvatarFallback className="bg-primary/15 font-black text-primary">
                        {c.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black group-hover:text-primary transition-colors">{c.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">@{c.username}</p>
                      {c.badge && (
                        <span className={cn('mt-1 inline-block rounded border px-2 py-0.5 text-[10px] font-bold', badgeClasses(c.badge))}>
                          {c.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  {hasStats(c) && (
                    <div className="hidden md:flex flex-col gap-1 text-xs">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Flame className="h-3.5 w-3.5 text-orange-500" />{c.streak} day streak
                      </span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Target className="h-3.5 w-3.5 text-rose-500" />{c.accuracy}% accuracy
                      </span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Trophy className="h-3.5 w-3.5 text-amber-500" />
                        {c.rank !== null ? `Rank #${c.rank.toLocaleString()}` : 'Unranked'}
                      </span>
                    </div>
                  )}

                  {/* Follow */}
                  {!c.isMe && (
                    <span onClick={(e) => e.stopPropagation()} className="shrink-0">
                      <FollowButton
                        username={c.username}
                        initialFollowing={c.isFollowedByMe}
                        followsMe={c.followsMe}
                        size="sm"
                      />
                    </span>
                  )}
                </div>
              );
            })}

            {list.length === 0 && (
              <div className={cn('rounded-2xl p-12 text-center', panel)}>
                <p className="text-sm font-medium text-muted-foreground">
                  {isSearchMode
                    ? (searched && !searching ? `No students match "${query.trim()}".` : 'Searching…')
                    : 'No students to show here yet.'}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-6 text-center text-sm text-muted-foreground">
            Can&apos;t find who you&apos;re looking for?{' '}
            <button type="button" onClick={copyInvite} className="font-bold text-primary hover:underline">
              Invite them!
            </button>
          </div>
        </main>

        {/* ── Profile preview ─────────────────────────────────────────── */}
        <aside className="hidden xl:block w-80 shrink-0">
          <div className="sticky top-6 space-y-5">
            {selected && preview ? (
              <>
                <div className={cn('relative overflow-hidden rounded-2xl p-5', panel)}>
                  {preview.rank !== null && (
                    <div className={cn(
                      'absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-black',
                      isDark ? 'border border-primary/40 text-primary social-glow' : 'bg-primary/10 text-primary',
                    )}>
                      #{preview.rank.toLocaleString()}
                    </div>
                  )}
                  <div className="flex flex-col items-center text-center">
                    <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                      {selected.avatar ? <AvatarImage src={selected.avatar} alt={selected.name} className="object-cover" /> : null}
                      <AvatarFallback className="bg-primary/15 text-3xl font-black text-primary">
                        {selected.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h2 className="mt-3 flex items-center gap-1.5 text-xl font-black">
                      {selected.name}
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </h2>
                    <p className="text-sm text-muted-foreground">@{selected.username}</p>
                    {selected.badge && (
                      <span className={cn('mt-2 inline-block rounded border px-3 py-1 text-xs font-bold', badgeClasses(selected.badge))}>
                        {selected.badge}
                      </span>
                    )}
                  </div>

                  {/* Stat trio */}
                  <div className={cn(
                    'mt-5 flex items-center justify-between rounded-xl p-3',
                    isDark ? 'border border-white/10 bg-white/[0.03]' : 'neu-inset',
                  )}>
                    {[
                      { label: 'Tests', value: preview.tests.toLocaleString() },
                      { label: 'Accuracy', value: `${preview.accuracy}%` },
                      { label: 'Rank', value: preview.rank !== null ? `#${preview.rank.toLocaleString()}` : '—' },
                    ].map((s, i) => (
                      <div key={s.label} className="flex flex-1 items-center justify-center">
                        {i > 0 && <span className="mr-auto h-8 w-px bg-border" />}
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                          <p className={cn('text-base font-black', s.label === 'Accuracy' ? 'text-primary' : 'text-foreground')}>{s.value}</p>
                        </div>
                        {i < 2 && <span className="ml-auto h-8 w-px bg-border" />}
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex gap-2">
                    {!selected.isMe && (
                      <FollowButton
                        username={selected.username}
                        initialFollowing={selected.isFollowedByMe}
                        followsMe={selected.followsMe}
                        className="flex-1"
                      />
                    )}
                    <Link
                      href={`/u/${selected.username}`}
                      title="View full profile"
                      className={cn(
                        'flex h-10 w-12 items-center justify-center rounded-xl transition-colors',
                        isDark ? 'border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5' : 'neu-raised text-muted-foreground hover:text-primary',
                      )}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                {/* Achievements */}
                <div className={cn('rounded-2xl p-5', panel)}>
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-black">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Highlights
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: Flame, tint: 'text-orange-500', value: preview.streak, label: 'Streak' },
                      { icon: Target, tint: 'text-rose-500', value: `${preview.accuracy}%`, label: 'Accuracy' },
                      { icon: Trophy, tint: 'text-amber-500', value: preview.rank !== null ? `#${preview.rank}` : '—', label: 'Rank' },
                      { icon: Zap, tint: 'text-violet-500', value: preview.tests, label: 'Tests' },
                    ].map((a) => (
                      <div key={a.label} className="flex flex-col items-center gap-1.5 text-center">
                        <div className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
                          isDark ? 'border border-white/10 bg-white/[0.03]' : 'neu-inset',
                        )}>
                          <a.icon className={cn('h-4 w-4', a.tint)} />
                        </div>
                        <p className="text-xs font-black leading-none">{a.value}</p>
                        <p className="text-[9px] leading-tight text-muted-foreground">{a.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className={cn('rounded-2xl p-12 text-center', panel)}>
                <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  Select a student to preview their profile.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
