import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { normalizeMonitorLogsPage } from "@/lib/monitor-logs";

import { MonitorLogsPage } from "../-components/monitor-pages";

export const validateMonitorLogsSearch = z.object({
  page: z.preprocess(
    (value) => normalizeMonitorLogsPage(value as number | string | null),
    z.number().int().positive(),
  ),
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
