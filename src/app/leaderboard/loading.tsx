export default function LeaderboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-7 w-40 rounded-lg bg-muted animate-pulse" />
        </div>

        {/* Subject filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['Overall', 'Physics', 'Chemistry', 'Mathematics', 'Biology'].map((s) => (
            <div key={s} className="h-8 w-24 shrink-0 rounded-full bg-muted animate-pulse" />
          ))}
        </div>

        {/* My rank card */}
        <div className="h-20 rounded-xl bg-muted animate-pulse" />

        {/* Top-3 podium */}
        <div className="flex items-end justify-center gap-4 h-36">
          <div className="w-24 h-24 rounded-xl bg-muted animate-pulse" />
          <div className="w-24 h-32 rounded-xl bg-muted animate-pulse" />
          <div className="w-24 h-20 rounded-xl bg-muted animate-pulse" />
        </div>

        {/* Rank rows */}
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-muted animate-pulse"
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
