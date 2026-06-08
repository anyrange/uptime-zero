import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";

export function NotificationsSkeleton() {
  return (
    <div aria-label={m.common_loading()} className="grid gap-4" role="status">
      <span className="sr-only">{m.common_loading()}</span>
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} size="sm">
            <CardHeader>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-6 w-12" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="mt-2 grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="grid content-start gap-4">
          <SectionHeaderSkeleton />
          <div className="grid gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                className="grid gap-3 rounded-lg border border-border px-4 py-3"
                key={index}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid gap-2">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-4 w-64 max-w-full" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
        </section>
        <section className="grid content-start gap-4">
          <SectionHeaderSkeleton />
          <div className="grid gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
                key={index}
              >
                <Skeleton className="size-9 rounded-md" />
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-56 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeaderSkeleton() {
  return (
    <div className="grid gap-1">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}
