import { Outlet, createFileRoute } from "@tanstack/react-router";
import { all } from "better-all";

import {
  monitorQueryOptions,
  monitorStateQueryOptions,
} from "@/lib/queries/monitors";

import { MonitorWorkspace } from "../-components/monitor-workspace";
import { MonitorDetailSkeleton } from "../-components/monitors-skeleton";

// The workspace header and tabs stay mounted while tab routes load their own
// data in parallel with this layout's loader.
export const Route = createFileRoute("/_admin/monitors/$monitorId")({
  loader: async ({ context: { queryClient }, params: { monitorId } }) => {
    await all({
      detail: () => queryClient.ensureQueryData(monitorQueryOptions(monitorId)),
      state: () =>
        queryClient.ensureQueryData(monitorStateQueryOptions(monitorId)),
    });
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
