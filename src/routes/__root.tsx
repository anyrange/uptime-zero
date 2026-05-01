import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";

import type { AppRouterContext } from "@/lib/router-auth";

import { TooltipProvider } from "@/components/ui/tooltip";

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: Root,
});

function Root() {
  return (
    <TooltipProvider>
      <Outlet />
    </TooltipProvider>
  );
}
