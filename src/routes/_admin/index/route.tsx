import { createFileRoute } from "@tanstack/react-router";

import { OverviewPage } from "@/routes/_admin/index/-components/overview-page";
import { OverviewSkeleton } from "@/routes/_admin/index/-components/overview-skeleton";

// The overview reads the dashboard query loaded by the `/_admin` layout.
export const Route = createFileRoute("/_admin/")({
  pendingComponent: OverviewSkeleton,
  component: OverviewPage,
});
