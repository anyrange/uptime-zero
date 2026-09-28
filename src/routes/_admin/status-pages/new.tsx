import { createFileRoute } from "@tanstack/react-router";

import { statusPagesQueryOptions } from "@/lib/queries/status-pages";

import { NewStatusPagePage } from "./-components/status-page-pages";
import { StatusPageFormSkeleton } from "./-components/status-pages-skeleton";

export const Route = createFileRoute("/_admin/status-pages/new")({
  // The list carries the monitors the form can attach.
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(statusPagesQueryOptions());
  },
  pendingComponent: StatusPageFormSkeleton,
  component: NewStatusPagePage,
});
