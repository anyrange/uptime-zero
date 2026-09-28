import { createFileRoute, notFound } from "@tanstack/react-router";

import { accountQueryOptions } from "@/lib/queries/auth";
import { notificationsQueryOptions } from "@/lib/queries/notifications";

import {
  SettingsSectionPage,
  settingsSectionSchema,
} from "./-components/settings-page";
import { SettingsSkeleton } from "./-components/settings-skeleton";

export const Route = createFileRoute("/_admin/settings/$section")({
  beforeLoad: ({ params }) => {
    const section = settingsSectionSchema.safeParse(params.section);

    if (!section.success) {
      throw notFound();
    }

    return { section: section.data };
  },
  // Sections beyond the layout's settings data load only what they render.
  loader: async ({ context: { queryClient, section } }) => {
    if (section === "account") {
      await queryClient.ensureQueryData(accountQueryOptions());
    } else if (section === "notifications") {
      await queryClient.ensureQueryData(notificationsQueryOptions());
    }
  },
  pendingComponent: SettingsSkeleton,
  component: RouteComponent,
});

function RouteComponent() {
  const { section } = Route.useRouteContext();

  return <SettingsSectionPage section={section} />;
}
