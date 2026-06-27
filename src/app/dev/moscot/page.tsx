'use client';

/**
 * DEV-ONLY sandbox for tuning the Origin mascot ("Ori").
 * Visit /dev/mascot with `npm run dev`. Gated/removed in Phase 5 before ship.
 *
 * Phase 1: idle pose at several sizes. The state buttons are wired through to the
 * `state` prop now so Phase 2 can light them up without touching this page.
 */
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import { MASCOT_STATES, type MascotState } from '@/features/mascot/mascot-state';

const OriMascot = dynamic(() => import('@/features/mascot/OriMascot'), { ssr: false });

export default function MascotSandboxPage() {
  const [state, setState] = useState<MascotState>('idle');

  // Dev sandbox only: skip the site intro splash on this route. Child effects run
  // before the root layout's effect, so seeding the flag here pre-empts the intro.
  useEffect(() => {
    try {
      sessionStorage.setItem('origin-intro-seen', 'true');
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#05080f] text-slate-100">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold">Ori · mascot sandbox</h1>
          <p className="mt-1 text-sm text-slate-400">
            Phase 1 — procedural 3D scene + idle. Dev-only route.
          </p>
        </header>

        <div className="mb-8 flex flex-wrap gap-2">
          {MASCOT_STATES.map((s) => (
            <button
              key={s}
              onClick={() => setState(s)}
              className={
                'rounded-full px-4 py-2 text-sm font-medium transition ' +
                (state === s
                  ? 'bg-sky-400 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700')
              }
            >
              {s}
            </button>
          ))}
        </div>

        {/* Hero size */}
        <div className="mb-10 flex items-center justify-center rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-950 p-6">
          <div className="h-72 w-72">
            <OriMascot state={state} title="Ori (large)" />
          </div>
        </div>

        {/* Avatar sizes (as used in chat headers / bubbles) */}
        <div className="flex flex-wrap items-end gap-8">
          {[44, 64, 96, 140].map((px) => (
            <div key={px} className="flex flex-col items-center gap-2">
              <div
                className="overflow-hidden rounded-full border border-slate-800 bg-slate-900/60"
                style={{ width: px, height: px }}
              >
                <OriMascot state={state} title={`Ori ${px}px`} />
              </div>
              <span className="text-xs text-slate-500">{px}px</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
