import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";

export function PublicStatusSkeleton() {
  return (
    <div
      aria-label={m.common_loading()}
      className="flex min-h-screen flex-col gap-6 bg-background text-foreground"
      role="status"
    >
      <span className="sr-only">{m.common_loading()}</span>
      <header className="border-b border-border/60 bg-card/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-5 md:px-8">
          <div className="flex w-[150px] shrink-0">
            <Skeleton className="size-9 rounded-lg" />
          </div>
          <div className="hidden flex-row gap-1 md:flex">
            <Skeleton className="h-7 w-20 rounded-2xl" />
            <Skeleton className="h-7 w-20 rounded-2xl" />
            <Skeleton className="h-7 w-24 rounded-2xl" />
          </div>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-2 md:px-8">
        <div className="rounded-lg border border-border px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-6 w-56 max-w-full" />
            </div>
            <Skeleton className="hidden h-4 w-32 sm:block" />
          </div>
        </div>
        <section className="grid gap-3">
          <Card size="sm">
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    className="border-border/60 lg:border-l lg:pl-6 lg:first:border-l-0 lg:first:pl-0"
                    key={index}
                  >
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="mt-2 h-4 w-28" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
        <section className="grid gap-3">
          <div className="grid gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <div
              className="rounded-xl border border-border/60 bg-background/70 px-4 py-4"
              key={index}
            >
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
            </div>
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
