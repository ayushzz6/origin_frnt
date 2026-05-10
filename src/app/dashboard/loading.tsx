export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
        <div className="h-56 rounded-3xl bg-muted animate-pulse" />
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <div className="h-44 rounded-3xl bg-muted animate-pulse" />
            <div className="h-44 rounded-3xl bg-muted animate-pulse" />
          </div>
          <div className="space-y-6 lg:col-span-4">
            <div className="h-44 rounded-3xl bg-muted animate-pulse" />
            <div className="h-36 rounded-3xl bg-muted animate-pulse" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-40 rounded-3xl bg-muted animate-pulse" />
          <div className="h-40 rounded-3xl bg-muted animate-pulse" />
        </div>
        <div className="h-52 rounded-3xl bg-muted animate-pulse" />
      </div>
    </div>
  );
}
