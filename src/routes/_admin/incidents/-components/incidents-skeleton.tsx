import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";

export function IncidentsSkeleton() {
  return (
    <div aria-label={m.common_loading()} className="grid gap-4" role="status">
      <span className="sr-only">{m.common_loading()}</span>
      <Card className="overflow-hidden py-0">
        <div className="grid grid-cols-[120px_300px_240px_200px_110px_200px] gap-4 border-b border-border/70 px-4 py-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
        {Array.from({ length: 8 }, (_, index) => (
          <div
            className="grid grid-cols-[120px_300px_240px_200px_110px_200px] gap-4 border-b border-border/70 px-4 py-3 last:border-b-0"
            key={index}
          >
            <Skeleton className="h-5 w-20" />
            <div className="grid gap-2">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-44" />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-5 w-40" />
          </div>
        ))}
      </Card>
    </div>
  );
}
