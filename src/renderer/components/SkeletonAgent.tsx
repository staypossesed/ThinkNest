export default function SkeletonAgent() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-32 animate-pulse rounded bg-white/5" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-white/10" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
        </div>
      </div>
    </div>
  );
}
