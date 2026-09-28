import { createFileRoute } from "@tanstack/react-router";

import { MonitorOverviewPage } from "./-components/monitor-header";

export const Route = createFileRoute("/_admin/monitors/$monitorId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { monitorId } = Route.useParams();

  return <MonitorOverviewPage monitorId={monitorId} />;
}
