import { createFileRoute } from "@tanstack/react-router";

import { monitorListQueryOptions } from "@/lib/queries/monitors";

import { MonitorsIndexPage } from "./-components/monitor-pages";
import { MonitorsSkeleton } from "./-components/monitors-skeleton";

export const Route = createFileRoute("/_admin/monitors/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(monitorListQueryOptions());
  },
  pendingComponent: MonitorsSkeleton,
  component: MonitorsIndexPage,
});
