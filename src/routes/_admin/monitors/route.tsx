import {
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";

import { MonitorsIndexPage } from "./-components/monitor-pages";

export const Route = createFileRoute("/_admin/monitors")({
  component: RouteComponent,
});

function RouteComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (pathname !== "/monitors") {
    return <Outlet />;
  }

  return <MonitorsIndexPage />;
}
