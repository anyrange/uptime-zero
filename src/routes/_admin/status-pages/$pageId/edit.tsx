import { createFileRoute } from "@tanstack/react-router";

import { statusPageQueryOptions } from "@/lib/queries/status-pages";

import { EditStatusPagePage } from "../-components/status-page-pages";
import { StatusPageFormSkeleton } from "../-components/status-pages-skeleton";

export const Route = createFileRoute("/_admin/status-pages/$pageId/edit")({
  loader: async ({ context, params: { pageId } }) => {
    await context.queryClient.ensureQueryData(statusPageQueryOptions(pageId));
  },
  pendingComponent: StatusPageFormSkeleton,
  component: RouteComponent,
});

function RouteComponent() {
  const { pageId } = Route.useParams();

  return <EditStatusPagePage pageId={pageId} />;
}
