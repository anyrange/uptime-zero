import { createFileRoute } from "@tanstack/react-router";

import { publicStatusPageQueryOptions } from "@/lib/queries/status-pages";

import { PublicStatusPage } from "./-components/public-status-page";
import { PublicStatusSkeleton } from "./-components/public-status-skeleton";

export const Route = createFileRoute("/status/$slug")({
  loader: async ({ context, params: { slug } }) => {
    await context.queryClient.ensureQueryData(
      publicStatusPageQueryOptions(slug),
    );
  },
  pendingComponent: PublicStatusSkeleton,
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();

  return <PublicStatusPage slug={slug} />;
}
