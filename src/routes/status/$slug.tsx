import { createFileRoute } from "@tanstack/react-router";

import { PublicStatusPage } from "./-components/public-status-page";

export const Route = createFileRoute("/status/$slug")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  return <PublicStatusPage slug={slug} />;
}
