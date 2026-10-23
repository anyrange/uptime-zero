import { createFileRoute } from "@tanstack/react-router";

import { monitorListQueryOptions } from "@/lib/api/monitors";
import { MonitorsIndexPage } from "@/routes/_admin/monitors/-components/monitor-pages";
import { MonitorsSkeleton } from "@/routes/_admin/monitors/-components/monitors-skeleton";

export const Route = createFileRoute("/_admin/monitors/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(monitorListQueryOptions());
  },
  pendingComponent: MonitorsSkeleton,
  component: MonitorsIndexPage,
});
