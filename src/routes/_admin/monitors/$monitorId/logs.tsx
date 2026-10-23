import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { monitorLogsQueryOptions } from "@/lib/api/monitors";
import { MonitorLogsPage } from "@/routes/_admin/monitors/-components/monitor-pages";
import { MonitorsSkeleton } from "@/routes/_admin/monitors/-components/monitors-skeleton";

/** A missing or malformed page falls back to the first one. */
const monitorLogsSearchSchema = z.object({
  page: z.int().min(1).default(1).catch(1),
});

export const Route = createFileRoute("/_admin/monitors/$monitorId/logs")({
  validateSearch: monitorLogsSearchSchema,
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: async ({ context, params: { monitorId }, deps: { page } }) => {
    const logs = await context.queryClient.ensureQueryData(
      monitorLogsQueryOptions(monitorId, page),
    );

    // The API clamps out-of-range pages; keep the URL on the page it served.
    if (logs.page !== page) {
      throw redirect({
        to: "/monitors/$monitorId/logs",
        params: { monitorId },
        search: { page: logs.page },
        replace: true,
      });
    }
  },
  pendingComponent: MonitorsSkeleton,
  component: RouteComponent,
});

function RouteComponent() {
  const { monitorId } = Route.useParams();
  const { page } = Route.useLoaderDeps();

  return <MonitorLogsPage monitorId={monitorId} page={page} />;
}
