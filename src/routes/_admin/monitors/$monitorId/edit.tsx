import { createFileRoute } from "@tanstack/react-router";

import { EditMonitorPage } from "../-components/monitor-pages";

export const Route = createFileRoute("/_admin/monitors/$monitorId/edit")({
  component: RouteComponent,
});

function RouteComponent() {
  const { monitorId } = Route.useParams();
  return <EditMonitorPage monitorId={monitorId} />;
}
