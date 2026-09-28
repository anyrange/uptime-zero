import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/settings/")({
  beforeLoad: () => {
    throw redirect({
      to: "/settings/$section",
      params: { section: "general" },
      replace: true,
    });
  },
});
