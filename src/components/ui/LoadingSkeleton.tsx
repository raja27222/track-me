export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-5">
        <div className="neu-card h-24 animate-pulse rounded-3xl" />
        <div className="neu-card flex h-80 flex-col items-center justify-center rounded-3xl p-6">
          <div className="neu-inset h-48 w-48 animate-pulse rounded-full" />
        </div>
      </div>
      <div className="space-y-4 lg:col-span-7">
        <div className="neu-card h-16 animate-pulse rounded-3xl" />
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="neu-card h-20 animate-pulse rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="neu-card h-28 animate-pulse rounded-3xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="neu-card h-72 animate-pulse rounded-3xl" />
        <div className="neu-card h-72 animate-pulse rounded-3xl" />
      </div>
    </div>
  );
}
