export default function OGCodeLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-36 rounded-lg bg-muted animate-pulse" />
          <div className="h-9 w-24 rounded-lg bg-muted animate-pulse" />
        </div>

        {/* Stats strip */}
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-1 h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>

        {/* Subject tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['All', 'Physics', 'Chemistry', 'Mathematics', 'Biology'].map((s) => (
            <div key={s} className="h-9 w-24 shrink-0 rounded-full bg-muted animate-pulse" />
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex gap-3">
          <div className="flex-1 h-9 rounded-lg bg-muted animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-muted animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-muted animate-pulse" />
        </div>

        {/* Question rows */}
        <div className="space-y-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-muted animate-pulse"
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
