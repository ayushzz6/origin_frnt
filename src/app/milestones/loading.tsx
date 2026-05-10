export default function MilestonesLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Back + header */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-7 w-44 rounded-lg bg-muted animate-pulse" />
        </div>

        {/* Points hero card */}
        <div className="h-40 rounded-2xl bg-muted animate-pulse" />

        {/* Tier progress bar */}
        <div className="h-6 rounded-full bg-muted animate-pulse" />

        {/* Tab strip */}
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-full bg-muted animate-pulse" />
          <div className="h-9 w-28 rounded-full bg-muted animate-pulse" />
        </div>

        {/* Milestone cards */}
        <div className="grid gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-muted animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
