import type { QueryClient } from "@tanstack/react-query";

import { redirect } from "@tanstack/react-router";
import { z } from "zod";

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
    const parsedError = z
      .object({ response: z.instanceof(Response) })
      .safeParse(error);
    if (parsedError.success && parsedError.data.response.status === 401) {
      throw redirect({ to: "/login" });
    }

    throw error;
  }
}
