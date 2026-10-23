import { createFileRoute } from "@tanstack/react-router";

import { MonitorIncidentsPage } from "@/routes/_admin/monitors/-components/monitor-pages";

export const Route = createFileRoute("/_admin/monitors/$monitorId/incidents")({
  component: RouteComponent,
});

function RouteComponent() {
  const { monitorId } = Route.useParams();

  return <MonitorIncidentsPage monitorId={monitorId} />;
}
