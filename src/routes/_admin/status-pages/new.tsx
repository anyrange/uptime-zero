import { createFileRoute } from "@tanstack/react-router";

import { statusPagesQueryOptions } from "@/lib/api/status-pages";
import { NewStatusPagePage } from "@/routes/_admin/status-pages/-components/status-page-pages";
import { StatusPageFormSkeleton } from "@/routes/_admin/status-pages/-components/status-pages-skeleton";

export const Route = createFileRoute("/_admin/status-pages/new")({
  // The list carries the monitors the form can attach.
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(statusPagesQueryOptions());
  },
  pendingComponent: StatusPageFormSkeleton,
  component: NewStatusPagePage,
});
