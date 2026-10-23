import { createFileRoute } from "@tanstack/react-router";

import { monitorListQueryOptions } from "@/lib/api/monitors";
import { NewMonitorPage } from "@/routes/_admin/monitors/-components/monitor-pages";
import { MonitorFormSkeleton } from "@/routes/_admin/monitors/-components/monitors-skeleton";

export const Route = createFileRoute("/_admin/monitors/new")({
  // The list carries the notification destinations the form offers.
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(monitorListQueryOptions());
  },
  pendingComponent: MonitorFormSkeleton,
  component: NewMonitorPage,
});
