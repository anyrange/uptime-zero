import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import {
  authenticatedMiddleware,
  permissionMiddleware,
} from "@/lib/api/middleware";
import { authClient, unwrapAuthResult } from "@/lib/auth-client";
import * as accounts from "@/modules/accounts/accounts.service";

export const getAccount = createServerFn({ method: "GET" })
  .middleware([authenticatedMiddleware])
  .handler(({ context }) => accounts.find(context.user.id));

/** Deletes the admin with every monitor, page and destination. */
export const deleteWorkspace = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("account.deleteWorkspace")])
  .handler(({ context }) => accounts.deleteWorkspace(context.user.id));

export function accountQueryOptions() {
  return queryOptions({
    queryKey: ["auth", "account"],
    queryFn: () => getAccount(),
  });
}

export function useUpdateAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    // Profile edits go through Better Auth, which owns the user record.
    mutationFn: (payload: { name: string }) =>
      unwrapAuthResult(authClient.updateUser({ name: payload.name.trim() })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useDeleteAccountMutation() {
  return useMutation({
    // Callers reload into setup, which discards every cached query.
    mutationFn: () => deleteWorkspace(),
  });
}
