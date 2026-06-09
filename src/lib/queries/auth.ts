import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { AccountData } from "@/types";

import { apiClient, parseResponse } from "@/lib/api-client";
import { privateKey } from "@/lib/queries/keys";

export function setupStateQueryOptions() {
  return queryOptions({
    queryKey: ["auth", "setup-state"],
    queryFn: () => parseResponse(apiClient.auth["setup-state"].$get()),
  });
}

export function useSetupStateQuery() {
  return useQuery(setupStateQueryOptions());
}

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: ["auth", "session"],
    queryFn: () => parseResponse(apiClient.auth.session.$get()),
  });
}

export function useSessionQuery() {
  return useQuery(sessionQueryOptions());
}

export function accountQueryOptions() {
  return queryOptions({
    queryKey: ["auth", "account"],
    queryFn: () =>
      parseResponse(apiClient.auth.account.$get()) as Promise<AccountData>,
  });
}

export function useAccountQuery() {
  return useQuery(accountQueryOptions());
}

export function useSetupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; email: string; password: string }) =>
      parseResponse(apiClient.auth.setup.$post({ json: payload })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      parseResponse(apiClient.auth.login.$post({ json: payload })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => parseResponse(apiClient.auth.logout.$post()),
    onSuccess: async () => {
      await invalidateSignedOutQueries(queryClient);
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => parseResponse(apiClient.auth.account.$delete()),
    onSuccess: async () => {
      await invalidateSignedOutQueries(queryClient);
    },
  });
}

async function invalidateSignedOutQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: privateKey() });
  queryClient.removeQueries({ queryKey: privateKey() });
  queryClient.removeQueries({ queryKey: ["auth", "account"] });
  queryClient.setQueryData(sessionQueryOptions().queryKey, { user: null });
}
