import { createFileRoute } from "@tanstack/react-router";

import { EditStatusPagePage } from "../-components/status-page-pages";

export const Route = createFileRoute("/_admin/status-pages/$pageId/edit")({
  component: RouteComponent,
});

function RouteComponent() {
  const { pageId } = Route.useParams();
  return <EditStatusPagePage pageId={pageId} />;
}
