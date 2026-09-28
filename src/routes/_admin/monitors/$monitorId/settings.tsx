import { createFileRoute } from "@tanstack/react-router";

import { monitorListQueryOptions } from "@/lib/queries/monitors";

import { MonitorSettingsPage } from "../-components/monitor-pages";
import { MonitorFormSkeleton } from "../-components/monitors-skeleton";

export const Route = createFileRoute("/_admin/monitors/$monitorId/settings")({
  // The list carries the notification destinations the form offers.
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(monitorListQueryOptions());
  },
  pendingComponent: MonitorFormSkeleton,
  component: RouteComponent,
});

function RouteComponent() {
  const { monitorId } = Route.useParams();

  return <MonitorSettingsPage monitorId={monitorId} />;
}
