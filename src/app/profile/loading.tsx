export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-7 w-40 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="h-64 rounded-[2rem] bg-muted animate-pulse" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-52 rounded-[2rem] bg-muted animate-pulse" />
          <div className="h-52 rounded-[2rem] bg-muted animate-pulse" />
        </div>
        <div className="h-72 rounded-[2rem] bg-muted animate-pulse" />
      </div>
    </div>
  );
}
