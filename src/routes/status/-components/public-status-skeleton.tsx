import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";

export function PublicStatusSkeleton() {
  return (
    <div aria-label={m.common_loading()} className="grid gap-4" role="status">
      <span className="sr-only">{m.common_loading()}</span>
      <Card className="px-5 py-5">
        <div className="grid gap-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </Card>
      {Array.from({ length: 3 }, (_, index) => (
        <Card className="px-5 py-5" key={index}>
          <Skeleton className="h-6 w-48" />
        </Card>
      ))}
    </div>
  );
}
