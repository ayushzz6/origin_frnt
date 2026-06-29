'use client';

/**
 * Phase 14 — student "Connect" home. Three tabs:
 *   • Enter code     — Flow 1 (redeem + subject pick)
 *   • Browse         — active collaborator institutes (Flow 2 entry, checkout in 2B)
 *   • My institutes  — the subjects the student has already unlocked
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, GraduationCap, Loader2, Radio, Search, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

import { Badge } from '@/components/ui/badge';
import {
  joinConnectRoom,
  listConnectCollaborators,
  listConnectRooms,
  listMyInstitutes,
  type ConnectCollaborator,
  type ConnectRoom,
  type StudentInstitute,
} from '@/features/connect/client';

import { ConnectRedeemPanel } from './ConnectRedeemPanel';
import { cn } from '@/lib/utils';

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, delay: 0.06 * i },
});

function BrowsePanel() {
  const [collaborators, setCollaborators] = useState<ConnectCollaborator[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listConnectCollaborators()
      .then((rows) => { if (!cancelled) setCollaborators(rows); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load institutes.');
        setCollaborators([]);
      });
    return () => { cancelled = true; };
  }, []);

  if (collaborators === null) {
    return (
      <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading institutes…
      </div>
    );
  }

  if (error) {
    return (
      <div className="neu-raised p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (collaborators.length === 0) {
    return (
      <div className="neu-raised p-8 text-center space-y-2">
        <Building2 className="w-10 h-10 text-muted-foreground/40 mx-auto" />
        <p className="font-bold text-foreground">No institutes yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Collaborating institutes will appear here. If you have a code, use the "Enter code" tab.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {collaborators.map((inst, i) => (
        <motion.div key={inst.workspaceId} {...stagger(i)} className="neu-raised p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-sm text-foreground truncate">{inst.displayName}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {[inst.city, inst.state, inst.country].filter(Boolean).join(', ') || 'Online'}
                </p>
              </div>
            </div>
            {inst.verified && (
              <span className="text-[9px] font-black uppercase tracking-wider text-primary border border-primary/30 bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                Verified
              </span>
            )}
          </div>
          {inst.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {inst.subjects.slice(0, 6).map((s) => (
                <span key={s} className="text-[10px] font-bold px-2.5 py-1 rounded-full neu-inset text-muted-foreground capitalize">
                  {s}
                </span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            {inst.studentCount} students · {inst.batchCount} batches
          </p>
          <Link
            href={`/connect/collaborators/${inst.workspaceId}`}
            className="neu-btn text-center text-[11px] font-black uppercase tracking-wider text-primary py-2 rounded-xl block"
          >
            View institute →
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

function JoinableRoomsPanel() {
  const router = useRouter();
  const [rooms, setRooms] = useState<ConnectRoom[] | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listConnectRooms()
      .then((rows) => { if (!cancelled) setRooms(rows); })
      .catch(() => { if (!cancelled) setRooms([]); });
    return () => { cancelled = true; };
  }, []);

  if (!rooms || rooms.length === 0) return null;

  async function handleJoin(roomId: string) {
    setJoiningId(roomId);
    try {
      const { roomId: joined } = await joinConnectRoom(roomId);
      router.push(`/study-rooms/${joined}/lobby`);
    } catch {
      setJoiningId(null);
    }
  }

  return (
    <div className="neu-raised p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Radio className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-black text-foreground">Live institute rooms</p>
          <p className="text-[10px] text-muted-foreground">Test rooms your teachers have opened for your batches.</p>
        </div>
      </div>
      <div className="space-y-2">
        {rooms.map((room) => (
          <div key={room.id} className="neu-inset rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-sm text-foreground">{room.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {[room.workspaceName, room.batchName].filter(Boolean).join(' · ') || 'Institute room'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {room.status === 'in_test'
                ? <span className="text-[9px] font-black uppercase tracking-wider text-red-500 border border-red-400/40 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">Live</span>
                : <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 border border-emerald-400/40 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">Lobby</span>
              }
              <button
                disabled={joiningId === room.id}
                onClick={() => handleJoin(room.id)}
                className="neu-btn text-[11px] font-black text-primary px-3 py-1.5 rounded-lg uppercase tracking-wider disabled:opacity-50"
              >
                {joiningId === room.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Join'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ENROLLMENT_STATUS: Record<
  StudentInstitute['enrollmentStatus'],
  { label: string; cls: string }
> = {
  active:     { label: 'Active',     cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400/40' },
  unassigned: { label: 'Enrolled',   cls: 'text-blue-600   bg-blue-50   dark:bg-blue-900/20   border-blue-400/40'   },
  suspended:  { label: 'Suspended',  cls: 'text-red-500    bg-red-50    dark:bg-red-900/20    border-red-400/40'    },
  left:       { label: 'Left',       cls: 'text-muted-foreground bg-muted border-border' },
};

function InstituteCard({ inst, index }: { inst: StudentInstitute; index: number }) {
  const status = ENROLLMENT_STATUS[inst.enrollmentStatus] ?? ENROLLMENT_STATUS.unassigned;
  const location = [inst.city, inst.state, inst.country].filter(Boolean).join(', ') || 'Online';

  return (
    <motion.div {...stagger(index)} className="neu-raised p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-sm text-foreground truncate">{inst.displayName}</p>
            <p className="text-[10px] text-muted-foreground">{location}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border', status.cls)}>
            {status.label}
          </span>
          {inst.verified && (
            <span className="text-[9px] font-black uppercase tracking-wider text-primary border border-primary/30 bg-primary/10 px-2 py-0.5 rounded-full">
              Verified
            </span>
          )}
        </div>
      </div>

      {/* Batches */}
      <div className="space-y-1.5">
        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Your batches</p>
        {inst.batches.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {inst.batches.map((b) => (
              <a
                key={b.id}
                href={`/connect/batches/${b.id}`}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full neu-inset text-muted-foreground hover:text-primary transition-colors"
              >
                {b.name}{b.subject ? ` · ${b.subject}` : ''} →
              </a>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/60">Awaiting batch assignment by the institute.</p>
        )}
      </div>

      {/* Unlocked subjects */}
      <div className="space-y-1.5">
        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Unlocked subjects</p>
        {inst.subjects.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {inst.subjects.map((s) => (
              <span key={s} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 capitalize">
                {s}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/60">No subject unlocked yet — pick one from the "Enter code" tab.</p>
        )}
      </div>

      {inst.isActiveCollaborator && (
        <Link
          href={`/connect/collaborators/${inst.workspaceId}`}
          className="neu-btn text-center text-[11px] font-black uppercase tracking-wider text-primary py-2 rounded-xl block mt-auto"
        >
          View institute →
        </Link>
      )}
    </motion.div>
  );
}

function MyInstitutesPanel() {
  const [institutes, setInstitutes] = useState<StudentInstitute[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyInstitutes()
      .then((rows) => { if (!cancelled) setInstitutes(rows); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load your institutes.');
        setInstitutes([]);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4">
      {institutes === null ? (
        <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading your institutes…
        </div>
      ) : error ? (
        <div className="neu-raised p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : institutes.length === 0 ? (
        <div className="neu-raised p-10 text-center space-y-2">
          <GraduationCap className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="font-bold text-foreground">No institutes yet</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Redeem an institute code in the "Enter code" tab or browse institutes to connect. Once you join, your institute and batches show up here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {institutes.map((inst, i) => (
            <InstituteCard key={inst.workspaceId} inst={inst} index={i} />
          ))}
        </div>
      )}
      <JoinableRoomsPanel />
    </div>
  );
}

const TABS = [
  { value: 'enter-code', label: 'Enter code' },
  { value: 'browse',     label: 'Browse'     },
  { value: 'my-institutes', label: 'My institutes' },
];

export function ConnectHome({ defaultTab = 'enter-code' }: { defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab);

  return (
    <div className="min-h-screen neu-surface font-sans">
      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* Page header */}
        <motion.div {...stagger(0)} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Connect</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Link your coaching institute, redeem a code, or browse institutes on ORIGIN.
            </p>
          </div>
        </motion.div>

        {/* Neumorphic tab bar */}
        <motion.div {...stagger(1)} className="neu-inset rounded-2xl p-1.5 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActive(tab.value)}
              className={cn(
                'flex-1 py-2 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-200',
                active === tab.value
                  ? 'neu-raised text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Tab content */}
        <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {active === 'enter-code' && <ConnectRedeemPanel />}
          {active === 'browse' && <BrowsePanel />}
          {active === 'my-institutes' && <MyInstitutesPanel />}
        </motion.div>

      </main>
    </div>
  );
}

export default ConnectHome;
