import { AlertTriangle } from 'lucide-react';

type DegradedBannerProps = {
  title?: string;
  reason?: string | null;
};

export function DegradedBanner({ title = 'Analytics degraded', reason }: DegradedBannerProps) {
  return (
    <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm leading-5">
            {reason || 'Some analytics details are temporarily unavailable. This result was scored locally.'}
          </p>
        </div>
      </div>
    </div>
  );
}
