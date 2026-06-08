import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";

export function SettingsSkeleton() {
  return (
    <div
      aria-label={m.common_loading()}
      className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]"
      role="status"
    >
      <span className="sr-only">{m.common_loading()}</span>
      <aside className="grid content-start gap-1 lg:pt-1">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="flex items-center gap-3 px-3 py-2.5" key={index}>
            <Skeleton className="size-4 rounded-md" />
            <Skeleton className="h-5 w-28" />
          </div>
        ))}
      </aside>
      <div className="flex flex-col gap-5">
        <div className="grid gap-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-0 rounded-xl border">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              className="grid gap-3 border-b border-border/70 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              key={index}
            >
              <div className="grid gap-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
              <Skeleton className="h-9 w-full md:w-72" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
