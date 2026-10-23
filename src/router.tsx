import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { Error } from "@/components/error";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // One client per request on the server, one per tab in the browser.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 2,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    // Loaders prime the query cache and components read it with
    // `useSuspenseQuery`, so routes render with data or fall back to their
    // `pendingComponent`; failures land in the nearest route error boundary.
    defaultErrorComponent: ({ error }) => (
      <Error
        message={
          error instanceof globalThis.Error ? error.message : String(error)
        }
      />
    ),
    // React Query owns caching, so every preload asks it for fresh-enough data.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultStructuralSharing: true,
  });

  // Streams query data fetched during SSR into the client cache and wraps the
  // app in a `QueryClientProvider`.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
