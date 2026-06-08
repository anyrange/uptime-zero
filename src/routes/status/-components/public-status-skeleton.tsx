import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";

export function PublicStatusSkeleton() {
  return (
    <div
      aria-label={m.common_loading()}
      className="min-h-screen bg-background text-foreground"
      role="status"
    >
      <span className="sr-only">{m.common_loading()}</span>
      <header className="border-b border-border/60 bg-card/40">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Skeleton className="h-7 w-44" />
          <div className="hidden items-center gap-2 sm:flex">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">
        <Card className="px-5 py-5">
          <Skeleton className="h-12 w-full" />
        </Card>
        <section className="grid gap-3">
          <div className="grid gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <Card className="px-4 py-4" key={index}>
              <div className="grid gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid gap-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>
                <Skeleton className="h-8 w-full" />
              </div>
            </Card>
          ))}
        </section>
        <section className="grid gap-3">
          <div className="grid gap-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-20 w-full" />
        </section>
      </main>
    </div>
  );
}
