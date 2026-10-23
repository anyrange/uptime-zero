import { redirect } from "@tanstack/react-router";

import type { AppRouterContext } from "@/routes/__root";

import { sessionQueryOptions } from "@/lib/api/auth";

/**
 * Navigation guard for private routes. It only shapes UX: every private
 * server function enforces its own permission middleware.
 */
export async function requireSession({ queryClient }: AppRouterContext) {
  const session = await queryClient.ensureQueryData(sessionQueryOptions());

  if (!session.user) throw redirect({ to: "/login" });

  return session;
}
