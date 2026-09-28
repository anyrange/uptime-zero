import { createFileRoute } from "@tanstack/react-router";

import { statusPagesQueryOptions } from "@/lib/queries/status-pages";

import { StatusPagesPage } from "./-components/status-page-pages";
import { StatusPagesSkeleton } from "./-components/status-pages-skeleton";

export const Route = createFileRoute("/_admin/status-pages/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(statusPagesQueryOptions());
  },
  pendingComponent: StatusPagesSkeleton,
  component: StatusPagesPage,
});
