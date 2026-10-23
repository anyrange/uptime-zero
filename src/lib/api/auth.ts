import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import type { Session } from "@/lib/schemas/auth";

import { accountQueryOptions } from "@/lib/api/accounts";
import { privateKey } from "@/lib/api/keys";
import { sessionMiddleware } from "@/lib/api/middleware";
import { authClient, unwrapAuthResult } from "@/lib/auth-client";
import * as accounts from "@/modules/accounts/accounts.service";

export const getSession = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(({ context }): Session => ({ user: context.user }));

export const getSetupState = createServerFn({ method: "GET" }).handler(
  async () => ({ hasAdmin: await accounts.hasAdmin(), appName: "Uptime Zero" }),
);

export function setupStateQueryOptions() {
  return queryOptions({
    queryKey: ["auth", "setup-state"],
    queryFn: () => getSetupState(),
  });
}

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: ["auth", "session"],
    queryFn: () => getSession(),
  });
}

export function useSetupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    // The first sign-up becomes the admin; the server rejects any later one.
    mutationFn: (payload: { name: string; email: string; password: string }) =>
      unwrapAuthResult(authClient.signUp.email(payload)),
    onSuccess: async () => {
      await refetchAuthQueries(queryClient);
    },
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      unwrapAuthResult(
        authClient.signIn.email({ ...payload, rememberMe: true }),
      ),
    onSuccess: async () => {
      await refetchAuthQueries(queryClient);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => unwrapAuthResult(authClient.signOut()),
    onSuccess: async () => {
      // Clear the session first so `/login` accepts the visit, and drop private
      // data only after the admin routes reading it through suspense unmount.
      queryClient.setQueryData(sessionQueryOptions().queryKey, { user: null });
      await router.navigate({ replace: true, to: "/login" });
      await queryClient.cancelQueries({ queryKey: privateKey() });
      queryClient.removeQueries({ queryKey: privateKey() });
      queryClient.removeQueries({ queryKey: accountQueryOptions().queryKey });
    },
  });
}

// Route guards read auth state through `ensureQueryData`, which returns cached
// data even when invalidated, so signing in fetches it again. Queries hydrated
// from SSR carry no `queryFn` until a component observes them, so they are
// fetched through their options rather than refetched in place.
async function refetchAuthQueries(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: accountQueryOptions().queryKey });

  await Promise.all([
    queryClient.fetchQuery({ ...sessionQueryOptions(), staleTime: 0 }),
    queryClient.fetchQuery({ ...setupStateQueryOptions(), staleTime: 0 }),
  ]);
}
