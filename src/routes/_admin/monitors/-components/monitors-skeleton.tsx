import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";

export function MonitorsSkeleton() {
  return (
    <div aria-label={m.common_loading()} className="grid gap-4" role="status">
      <span className="sr-only">{m.common_loading()}</span>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Card className="gap-3 px-5 py-5" key={index} size="sm">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-16" />
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Skeleton className="h-9 w-full md:max-w-xs" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <Card className="overflow-hidden py-0">
        {Array.from({ length: 9 }, (_, index) => (
          <div
            className="grid grid-cols-[44px_220px_96px_128px_240px_112px_140px_150px_56px] gap-4 border-b border-border/70 px-4 py-4 last:border-b-0"
            key={index}
          >
            <Skeleton className="size-5 rounded-md" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-6" />
          </div>
        ))}
      </Card>
    </div>
  );
}

export function MonitorFormSkeleton() {
  return (
    <Card className="max-w-5xl px-5 py-5">
      <div className="grid gap-5">
        <div className="grid gap-4 border-b border-border/70 pb-5 md:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <div className="grid gap-4 border-b border-border/70 pb-5 md:grid-cols-3">
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <div className="grid gap-3 border-b border-border/70 pb-5 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Card className="px-4 py-4" key={index}>
              <div className="flex items-center gap-3">
                <Skeleton className="size-5 rounded-md" />
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </Card>
  );
}

export function MonitorDetailSkeleton() {
  return (
    <div aria-label={m.common_loading()} className="grid gap-4" role="status">
      <span className="sr-only">{m.common_loading()}</span>
      <div className="grid gap-2 py-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Card className="gap-3 px-5 py-5" key={index} size="sm">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-16" />
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden py-0">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            className="grid grid-cols-[220px_120px_120px_minmax(0,1fr)] gap-4 border-b border-border/70 px-4 py-4 last:border-b-0"
            key={index}
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-56" />
          </div>
        ))}
      </Card>
    </div>
  );
}

function FieldSkeleton() {
  return (
    <div className="grid gap-2">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
