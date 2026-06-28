'use client';

/**
 * Phase 1.5 — Premium surface.
 *
 * Four per-subject cards (₹499/mo each). Owning ANY subject unlocks the global
 * tools (Origin AI, AI Explainer, Study Rooms); each owned subject unlocks its
 * full OG Code bank, Tests and DPP. Reads entitlement from useAuth().user.
 */

import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ChevronLeft, Atom, FlaskConical, Sigma, Dna, Shield, Check } from 'lucide-react';

const OriMascot = dynamic(() => import('@/features/mascot/Ori2D'), { ssr: false });

import { useAuth } from '@/context/AuthContext';
import { ALL_SUBJECTS, getEntitledSubjects, hasAnyPremium, type Subject } from '@/lib/entitlements';
import { ActiveBadge, SubjectCheckout } from '@/components/subscriptions/SubjectCheckout';
import { cn } from '@/lib/utils';

interface PremiumProps {
  onBack?: () => void;
}

const SUBJECT_META: Record<Subject, { label: string; Icon: typeof Atom; blurb: string }> = {
  physics: { label: 'Physics', Icon: Atom, blurb: 'Full OG Code bank, Tests & DPP for Physics.' },
  chemistry: { label: 'Chemistry', Icon: FlaskConical, blurb: 'Full OG Code bank, Tests & DPP for Chemistry.' },
  mathematics: { label: 'Mathematics', Icon: Sigma, blurb: 'Full OG Code bank, Tests & DPP for Mathematics.' },
  biology: { label: 'Biology', Icon: Dna, blurb: 'Full OG Code bank, Tests & DPP for Biology.' },
};

const GLOBAL_TOOLS = ['Origin AI', 'AI Explainer', 'Study Rooms'];

export default function Premium({ onBack }: PremiumProps) {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const owned = new Set(getEntitledSubjects(user));
  const anyPremium = hasAnyPremium(user);
  const handleBack = onBack ?? (() => router.back());
  const onChanged = () => void refreshUser();

  return (
    <div className="min-h-screen neu-surface text-foreground transition-colors duration-300">
      <header className="sticky top-0 z-40 bg-[hsl(var(--neu-bg))] border-b border-border/40 shadow-[0_2px_8px_hsl(var(--neu-shadow)/30%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 neu-raised rounded-xl hover:-translate-y-0.5 transition-all"
                aria-label="Go back"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <h1 className="text-xl font-bold text-foreground">Origin Premium</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-10">
          <div className="mb-4 flex justify-center">
            <div className="h-24 w-24 sm:h-28 sm:w-28">
              <OriMascot expression="thumbsup" title="Origin AI" />
            </div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Subscribe by subject
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            ₹499 / month per subject, billed monthly. Subscribe to any one subject and the global
            tools below unlock instantly. Cancel anytime — access lasts to the end of the period.
          </p>
        </div>

        {/* Global tools unlock banner */}
        <div className="neu-raised rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-8 sm:mb-10">
          <div>
            <h3 className="font-semibold text-foreground mb-2">
              Owning any subject unlocks
            </h3>
            <div className="flex flex-wrap gap-2">
              {GLOBAL_TOOLS.map((tool) => (
                <span
                  key={tool}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary font-medium"
                >
                  <Check className="w-3 h-3" /> {tool}
                </span>
              ))}
            </div>
          </div>
          <span className={cn(
            'text-sm font-bold',
            anyPremium ? 'text-emerald-500' : 'text-muted-foreground'
          )}>
            {anyPremium ? '✓ Unlocked' : 'Locked'}
          </span>
        </div>

        {/* Subject cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-10 sm:mb-12">
          {ALL_SUBJECTS.map((subject) => {
            const meta = SUBJECT_META[subject];
            const isOwned = owned.has(subject);
            const Icon = meta.Icon;
            return (
              <div
                key={subject}
                className={cn(
                  'relative neu-raised rounded-2xl overflow-hidden',
                  isOwned ? 'ring-2 ring-emerald-500/40' : ''
                )}
              >
                <div className="p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 neu-inset flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    {isOwned ? <ActiveBadge /> : null}
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{meta.label}</h3>
                  <div className="flex items-baseline gap-1 mt-1 mb-3">
                    <span className="text-2xl font-black text-primary">₹499</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground flex-1 mb-5">{meta.blurb}</p>
                  <SubjectCheckout subject={subject} label={meta.label} owned={isOwned} onChanged={onChanged} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-center gap-6 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <span className="text-sm">Secure payments by Razorpay</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5" />
            <span className="text-sm">Cancel anytime</span>
          </div>
        </div>
      </main>
    </div>
  );
}
