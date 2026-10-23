import { createFileRoute } from "@tanstack/react-router";

import { statusPagesQueryOptions } from "@/lib/api/status-pages";
import { StatusPagesPage } from "@/routes/_admin/status-pages/-components/status-page-pages";
import { StatusPagesSkeleton } from "@/routes/_admin/status-pages/-components/status-pages-skeleton";

export const Route = createFileRoute("/_admin/status-pages/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(statusPagesQueryOptions());
  },
  pendingComponent: StatusPagesSkeleton,
  component: StatusPagesPage,
});
