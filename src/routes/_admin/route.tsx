import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/router-auth";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ context }) => {
    await requireSession(context);
  },
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
