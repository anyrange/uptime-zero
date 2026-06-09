import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, HomeIcon, SearchXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { m } from "@/paraglide/messages.js";

export function NotFoundPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <section className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-md border bg-muted">
          <SearchXIcon className="text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            {m.not_found_code()}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            {m.not_found_title()}
          </h1>
          <p className="text-sm text-muted-foreground">
            {m.not_found_description()}
          </p>
        </div>
        <Separator />
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to="/">
              <HomeIcon data-icon="inline-start" aria-hidden="true" />
              {m.not_found_dashboard_action()}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.history.back()}
          >
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            {m.common_back()}
          </Button>
        </div>
      </section>
    </main>
  );
}
