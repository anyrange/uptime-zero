import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AdminLayout } from "@/components/admin-layout";
import { dashboardQueryOptions } from "@/lib/queries/dashboard";
import { requireSession } from "@/lib/router-auth";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ context }) => {
    await requireSession(context);
  },
  // The sidebar and command menu read the dashboard; child loaders run in
  // parallel with this one.
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(dashboardQueryOptions());
  },
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}
