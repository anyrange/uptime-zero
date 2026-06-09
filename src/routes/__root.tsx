import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import type { AppRouterContext } from "@/lib/router-auth";

import { NotFoundPage } from "@/components/not-found-page";
import { TooltipProvider } from "@/components/ui/tooltip";

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: Root,
  notFoundComponent: NotFoundPage,
});

function Root() {
  return (
    <TooltipProvider>
      <Outlet />
      <TanStackDevtools
        config={{
          position: "bottom-right",
        }}
        plugins={[
          {
            name: "TanStack Query",
            render: <ReactQueryDevtoolsPanel />,
            defaultOpen: true,
          },
          {
            name: "TanStack Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </TooltipProvider>
  );
}
