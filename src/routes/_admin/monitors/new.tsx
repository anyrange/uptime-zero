import { createFileRoute } from "@tanstack/react-router";

import { NewMonitorPage } from "./-components/monitor-pages";

export const Route = createFileRoute("/_admin/monitors/new")({
  component: NewMonitorPage,
});
