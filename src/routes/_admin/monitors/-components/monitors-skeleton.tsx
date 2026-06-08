import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";

export function MonitorsSkeleton() {
  return (
    <div aria-label={m.common_loading()} className="grid gap-4" role="status">
      <span className="sr-only">{m.common_loading()}</span>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Card key={index} size="sm">
            <CardHeader>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-6 w-16" />
            </CardHeader>
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
        <MonitorTableSkeletonRow header />
        {Array.from({ length: 9 }, (_, index) => (
          <MonitorTableSkeletonRow key={index} />
        ))}
      </Card>
    </div>
  );
}

export function MonitorFormSkeleton() {
  return (
    <Card className="max-w-5xl px-5 py-5">
      <div className="grid gap-5">
        <div className="grid gap-4 border-b border-border/70 pb-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <FieldSkeleton />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid gap-4 border-b border-border/70 pb-5 md:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <div className="grid gap-4 border-b border-border/70 pb-5 md:grid-cols-3">
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <div className="grid gap-4 border-b border-border/70 pb-5 md:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <div className="grid gap-4 border-b border-border/70 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </div>
        <div className="grid gap-3 border-b border-border/70 pb-5 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              className="flex items-center gap-3 rounded-md border border-border px-4 py-3"
              key={index}
            >
              <Skeleton className="size-5 rounded-md" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
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
          <Card key={index} size="sm">
            <CardHeader>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-6 w-16" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden py-0">
        <div className="grid grid-cols-[220px_120px_120px_minmax(0,1fr)] gap-4 border-b border-border/70 px-4 py-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-28" />
        </div>
        {Array.from({ length: 8 }, (_, index) => (
          <div
            className="grid grid-cols-[220px_120px_120px_minmax(0,1fr)] gap-4 border-b border-border/70 px-4 py-3 last:border-b-0"
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

function MonitorTableSkeletonRow({ header = false }: { header?: boolean }) {
  return (
    <div className="grid grid-cols-[44px_220px_96px_128px_240px_112px_140px_150px_56px] gap-4 border-b border-border/70 px-4 py-3 last:border-b-0">
      <Skeleton className="size-5 rounded-md" />
      <Skeleton className={`h-5 ${header ? "w-20" : "w-40"}`} />
      <Skeleton className={`h-5 ${header ? "w-12" : "w-12"}`} />
      <Skeleton className={`h-5 ${header ? "w-16" : "w-24"}`} />
      <Skeleton className={`h-5 ${header ? "w-16" : "w-52"}`} />
      <Skeleton className={`h-5 ${header ? "w-16" : "w-12"}`} />
      <Skeleton className={`h-5 ${header ? "w-20" : "w-20"}`} />
      <Skeleton className={`h-5 ${header ? "w-20" : "w-28"}`} />
      <Skeleton className="h-5 w-6" />
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
