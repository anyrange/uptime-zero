import { createFileRoute } from "@tanstack/react-router";

import { MonitorSettingsPage } from "../-components/monitor-pages";

export const Route = createFileRoute("/_admin/monitors/$monitorId/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  const { monitorId } = Route.useParams();
  return <MonitorSettingsPage monitorId={monitorId} />;
}
