// Streamed immediately by Next.js while tests/page.tsx awaits server data.
// Keeps the page layout stable so content slots in without a layout shift.
export default function TestsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-7 w-36 rounded-lg bg-muted animate-pulse" />
        </div>

        {/* Search + filter bar */}
        <div className="flex gap-3">
          <div className="flex-1 h-10 rounded-lg bg-muted animate-pulse" />
          <div className="h-10 w-28 rounded-lg bg-muted animate-pulse" />
          <div className="h-10 w-28 rounded-lg bg-muted animate-pulse" />
        </div>

        {/* Tab strip */}
        <div className="flex gap-2">
          {['All', 'Physics', 'Chemistry', 'Mathematics', 'Biology'].map((tab) => (
            <div key={tab} className="h-8 w-20 rounded-full bg-muted animate-pulse" />
          ))}
        </div>

        {/* Test cards */}
        <div className="grid gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-muted animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
