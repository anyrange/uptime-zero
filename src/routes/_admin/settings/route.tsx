import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppPage } from "@/components/page";
import { settingsQueryOptions } from "@/lib/queries/settings";
import { m } from "@/paraglide/messages.js";

import { SettingsNavigation } from "./-components/settings-page";
import { SettingsSkeleton } from "./-components/settings-skeleton";

export const Route = createFileRoute("/_admin/settings")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(settingsQueryOptions());
  },
  pendingComponent: SettingsSkeleton,
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <AppPage title={m.settings_title()}>
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:pt-1">
          <SettingsNavigation />
        </aside>
        <div className="flex flex-col gap-5">
          <Outlet />
        </div>
      </div>
    </AppPage>
  );
}
