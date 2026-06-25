'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';

const OriMascot = dynamic(() => import('@/features/mascot/Ori2D'), { ssr: false });

export default function NotFound() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="h-40 w-40 sm:h-52 sm:w-52">
        <OriMascot expression="surprise" title="Origin AI" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Hmm, this page wandered off</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Ori couldn’t find what you were looking for. Let’s get you back on track.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
