export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy aria-label="Loading">
      <div className="space-y-2">
        <div className="h-8 w-48 max-w-full rounded-md bg-muted" />
        <div className="h-4 w-full max-w-lg rounded-md bg-muted/70" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="mt-3 h-3 w-32 rounded bg-muted/60" />
            <div className="mt-6 flex items-end justify-between gap-4">
              <div className="h-9 w-14 rounded bg-muted" />
              <div className="h-8 w-16 rounded-md bg-muted/80" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
