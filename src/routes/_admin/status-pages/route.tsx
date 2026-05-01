import {
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";

import { StatusPagesPage } from "./-components/status-page-pages";

export const Route = createFileRoute("/_admin/status-pages")({
  component: RouteComponent,
});

function RouteComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (pathname !== "/status-pages") {
    return <Outlet />;
  }

  return <StatusPagesPage />;
}
