import { createFileRoute } from "@tanstack/react-router";

import { NewStatusPagePage } from "./-components/status-page-pages";

export const Route = createFileRoute("/_admin/status-pages/new")({
  component: NewStatusPagePage,
});
