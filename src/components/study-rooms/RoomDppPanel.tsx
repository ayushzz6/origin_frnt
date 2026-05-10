'use client';

import { BookOpenCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type RoomDppSummary = {
  id: string;
  title: string;
  subject: string;
  summary: string;
  duration_minutes: number;
  target_question_count: number;
  sequence: number;
};

export function RoomDppPanel({ dpps }: { dpps: RoomDppSummary[] }) {
  return (
    <section className="rounded-lg border border-primary/20 bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex items-center gap-2">
        <BookOpenCheck className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Your DPPs</h2>
      </div>
      {dpps.length === 0 ? (
        <p className="text-sm text-slate-500">DPPs appear here after your room submission is analyzed.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {dpps.map((dpp) => (
            <div key={dpp.id} className="rounded-lg border border-slate-100 p-4 dark:border-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <Badge variant="secondary" className="rounded-md">DPP {dpp.sequence}</Badge>
                <span className="text-xs font-bold text-slate-500">{dpp.duration_minutes}m</span>
              </div>
              <h3 className="mb-2 line-clamp-2 text-sm font-black">{dpp.title}</h3>
              <p className="mb-4 line-clamp-3 text-xs text-slate-500">{dpp.summary}</p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href="/dpp">Open DPP</a>
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
