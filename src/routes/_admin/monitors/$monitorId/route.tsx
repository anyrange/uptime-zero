import { Outlet, createFileRoute } from "@tanstack/react-router";

import {
  monitorQueryOptions,
  monitorStateQueryOptions,
} from "@/lib/api/monitors";
import { MonitorWorkspace } from "@/routes/_admin/monitors/-components/monitor-workspace";
import { MonitorDetailSkeleton } from "@/routes/_admin/monitors/-components/monitors-skeleton";

// The workspace header and tabs stay mounted while tab routes load their own
// data in parallel with this layout's loader.
export const Route = createFileRoute("/_admin/monitors/$monitorId")({
  loader: async ({ context: { queryClient }, params: { monitorId } }) => {
    await Promise.all([
      queryClient.ensureQueryData(monitorQueryOptions(monitorId)),
      queryClient.ensureQueryData(monitorStateQueryOptions(monitorId)),
    ]);
  },
  pendingComponent: MonitorDetailSkeleton,
  component: RouteComponent,
});

function RouteComponent() {
  const { monitorId } = Route.useParams();

  return (
    <MonitorWorkspace monitorId={monitorId}>
      <Outlet />
    </MonitorWorkspace>
  );
}
