export default function StudyCornerLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="h-10 w-52 rounded-lg bg-muted animate-pulse" />
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="h-[520px] rounded-3xl bg-muted animate-pulse" />
          <div className="space-y-4">
            <div className="h-16 rounded-2xl bg-muted animate-pulse" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-40 rounded-3xl bg-muted animate-pulse"
                  style={{ animationDelay: `${index * 50}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
