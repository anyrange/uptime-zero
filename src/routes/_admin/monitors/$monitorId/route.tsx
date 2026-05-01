import {
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";

import { MonitorDetailPage } from "./-components/monitor-header";

export const Route = createFileRoute("/_admin/monitors/$monitorId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { monitorId } = Route.useParams();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (pathname !== `/monitors/${monitorId}`) {
    return <Outlet />;
  }

  return <MonitorDetailPage monitorId={monitorId} />;
}
