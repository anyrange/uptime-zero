import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AdminLayout } from "@/components/admin-layout";
import { dashboardQueryOptions } from "@/lib/api/dashboard";
import { requireSession } from "@/lib/router-auth";

export const Route = createFileRoute("/_admin")({
  // Loaders still run during the server request, but the private dashboard is
  // rendered only in the browser: its timestamps depend on the viewer's clock
  // and time zone, and server HTML buys nothing behind a login.
  ssr: "data-only",
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
