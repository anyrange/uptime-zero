import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";

export function OverviewSkeleton() {
  return (
    <div
      aria-label={m.common_loading()}
      className="flex flex-col gap-8"
      role="status"
    >
      <span className="sr-only">{m.common_loading()}</span>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Card className="gap-3 px-5 py-5" key={index} size="sm">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-16" />
          </Card>
        ))}
      </div>
      <section className="flex flex-col gap-3">
        <div className="grid gap-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <Card className="gap-3 px-5 py-5" key={index} size="sm">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-7 w-16" />
            </Card>
          ))}
        </div>
        <Card className="overflow-hidden py-0">
          {Array.from({ length: 10 }, (_, index) => (
            <div
              className="grid grid-cols-[220px_220px_150px_90px_120px_120px_minmax(0,1fr)] gap-4 border-b border-border/70 px-4 py-4 last:border-b-0"
              key={index}
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
