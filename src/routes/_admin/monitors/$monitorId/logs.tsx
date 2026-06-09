import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { MonitorLogsPage } from "../-components/monitor-pages";

export const validateMonitorLogsSearch = z.object({
  page: z.coerce.number().int().min(1).catch(1),
});

export const Route = createFileRoute("/_admin/monitors/$monitorId/logs")({
  validateSearch: validateMonitorLogsSearch,
  component: RouteComponent,
});

function RouteComponent() {
  const { monitorId } = Route.useParams();
  const search = Route.useSearch();

  return <MonitorLogsPage monitorId={monitorId} page={search.page} />;
}
