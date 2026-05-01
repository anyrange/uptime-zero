import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "./-components/settings-page";

export const Route = createFileRoute("/_admin/settings/$section")({
  component: SettingsPage,
});
