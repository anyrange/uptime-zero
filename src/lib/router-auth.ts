import type { QueryClient } from "@tanstack/react-query";

import { redirect } from "@tanstack/react-router";

import { sessionQueryOptions } from "@/lib/queries/auth";

export type AppRouterContext = {
  queryClient: QueryClient;
};

export async function requireSession({ queryClient }: AppRouterContext) {
  try {
    const session = await queryClient.ensureQueryData(sessionQueryOptions());

    if (!session.user) {
      throw redirect({ to: "/login" });
    }

    return session;
  } catch (error) {
    if (isUnauthorizedError(error)) {
      throw redirect({ to: "/login" });
    }

    throw error;
  }
}

function isUnauthorizedError(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "response" in error &&
    error.response instanceof Response &&
    error.response.status === 401
  );
}
