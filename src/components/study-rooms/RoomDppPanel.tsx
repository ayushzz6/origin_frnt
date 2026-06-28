'use client';

import Link from 'next/link';
import { BookOpenCheck, Clock, ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export type RoomDppSummary = {
  id: string;
  title: string;
  subject: string;
  summary: string;
  duration_minutes: number;
  target_question_count: number;
  sequence: number;
};

const SUBJECT_COLORS: Record<string, string> = {
  Physics:     'text-primary bg-primary/10',
  Chemistry:   'text-sky-500 bg-sky-500/10',
  Mathematics: 'text-indigo-500 bg-indigo-500/10',
  Biology:     'text-emerald-500 bg-emerald-500/10',
};

export function RoomDppPanel({ dpps }: { dpps: RoomDppSummary[] }) {
  return (
    <section className="neu-raised rounded-2xl p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <BookOpenCheck className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Your DPPs</h2>
      </div>

      {dpps.length === 0 ? (
        <div className="neu-inset rounded-xl p-5 text-center text-sm text-muted-foreground">
          DPPs appear here after your room submission is analyzed.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {dpps.map((dpp) => (
            <div key={dpp.id} className="neu-inset rounded-xl p-4 flex flex-col gap-2">
              {/* Top row */}
              <div className="flex items-center justify-between gap-2">
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider',
                  SUBJECT_COLORS[dpp.subject] ?? 'text-muted-foreground bg-muted'
                )}>
                  {dpp.subject}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {dpp.duration_minutes}m
                </span>
              </div>

              {/* Title */}
              <p className="text-sm font-black text-foreground">{dpp.title}</p>

              {/* Summary */}
              <p className="text-xs text-muted-foreground line-clamp-2">{dpp.summary}</p>

              {/* Footer */}
              <div className="mt-auto pt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{dpp.target_question_count} questions</span>
                <Link
                  href={`/dpp/${dpp.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  Start <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
