import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { apiClient, parseResponse } from "@/lib/api-client";
import { privateKey } from "@/lib/queries/keys";

export function setupStateQueryOptions() {
  return queryOptions({
    queryKey: ["auth", "setup-state"],
    queryFn: () => parseResponse(apiClient.auth["setup-state"].$get()),
  });
}

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: ["auth", "session"],
    queryFn: () => parseResponse(apiClient.auth.session.$get()),
  });
}

export function accountQueryOptions() {
  return queryOptions({
    queryKey: ["auth", "account"],
    queryFn: () => parseResponse(apiClient.auth.account.$get()),
  });
}

export function useSetupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; email: string; password: string }) =>
      parseResponse(apiClient.auth.setup.$post({ json: payload })),
    onSuccess: async () => {
      await refetchAuthQueries(queryClient);
    },
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      parseResponse(apiClient.auth.login.$post({ json: payload })),
    onSuccess: async () => {
      await refetchAuthQueries(queryClient);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => parseResponse(apiClient.auth.logout.$post()),
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

export function useUpdateAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string }) =>
      parseResponse(apiClient.auth.account.$put({ json: payload })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useDeleteAccountMutation() {
  return useMutation({
    // Callers reload into setup, which discards every cached query.
    mutationFn: () => parseResponse(apiClient.auth.account.$delete()),
  });
}

// Route guards read the session through `ensureQueryData`, which returns cached
// data even when invalidated, so signing in refetches inactive auth queries too.
async function refetchAuthQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({
    queryKey: ["auth"],
    refetchType: "all",
  });
}
