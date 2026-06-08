import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";

export function StatusPagesSkeleton() {
  return (
    <div aria-label={m.common_loading()} className="grid gap-4" role="status">
      <span className="sr-only">{m.common_loading()}</span>
      <Card className="overflow-hidden py-0">
        <div className="grid grid-cols-[minmax(0,1fr)_160px_140px_180px_56px] gap-4 border-b border-border/70 px-4 py-3">
          <Skeleton className="ml-5 h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-6" />
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_160px_140px_180px_56px] gap-4 border-b border-border/70 px-4 py-3 last:border-b-0"
            key={index}
          >
            <div className="ml-5 grid gap-2">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-6" />
          </div>
        ))}
      </Card>
    </div>
  );
}

export function StatusPageFormSkeleton() {
  return (
    <Card className="max-w-4xl px-5 py-5">
      <div className="grid gap-5">
        <div className="grid gap-4 border-b border-border/70 pb-5 md:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="grid gap-4 border-b border-border/70 pb-5">
          <div className="grid gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="grid gap-3 border-b border-border/70 pb-5 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              className="flex items-center gap-3 rounded-md border border-border px-4 py-3"
              key={index}
            >
              <Skeleton className="size-5 rounded-md" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </Card>
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
