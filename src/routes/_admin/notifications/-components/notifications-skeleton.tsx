import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";

export function NotificationsSkeleton() {
  return (
    <Card aria-label={m.common_loading()} className="px-5 py-5" role="status">
      <span className="sr-only">{m.common_loading()}</span>
      <div className="grid gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="grid gap-2 border-b border-border/70 pb-4 last:border-b-0"
            key={index}
          >
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </div>
        ))}
      </div>
    </Card>
  );
}
