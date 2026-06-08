import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AdminLayout } from "@/components/admin-layout";
import { requireSession } from "@/lib/router-auth";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ context }) => {
    await requireSession(context);
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
