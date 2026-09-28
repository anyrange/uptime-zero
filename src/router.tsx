import { createRouter } from "@tanstack/react-router";

import { Error } from "@/components/error";

import * as TanstackQuery from "./lib/providers/query-provider";
import { routeTree } from "./routeTree.gen";

export const routerContext = TanstackQuery.getContext();

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: { ...routerContext },
    defaultPreload: "intent",
    // Loaders prime the query cache and components read it with
    // `useSuspenseQuery`, so routes render with data or fall back to their
    // `pendingComponent`; failures land in the nearest route error boundary.
    defaultErrorComponent: ({ error }) => <Error message={error.message} />,
    // react-query will handle data fetching & caching
    // https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#passing-all-loader-events-to-an-external-cache
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultStructuralSharing: true,
    // Wrap: (props: { children: React.ReactNode }) => {
    //   return (
    //     <TanstackQuery.Provider {...rqContext}>
    //       {props.children}
    //     </TanstackQuery.Provider>
    //   );
    // },
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
