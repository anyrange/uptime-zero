import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient, parseResponse } from "@/lib/api-client";
import { privateKey } from "@/lib/queries/keys";

export type StatusPagePayload = {
  title: string;
  slug: string;
  description: string | null;
  published: boolean;
  showHistory: boolean;
  monitorIds: string[];
};

export function useStatusPagesQuery() {
  return useQuery({
    queryKey: privateKey("status-pages"),
    queryFn: () => parseResponse(apiClient["status-pages"].$get()),
  });
}

export function useStatusPageQuery(id: string) {
  return useQuery({
    queryKey: privateKey("status-pages", id),
    queryFn: () =>
      parseResponse(apiClient["status-pages"][":id"].$get({ param: { id } })),
  });
}

export function usePublicStatusPageQuery(slug: string) {
  return useQuery({
    queryKey: ["public-status", slug],
    queryFn: () =>
      parseResponse(apiClient.status[":slug"].$get({ param: { slug } })),
  });
}

export function useCreateStatusPageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: StatusPagePayload) =>
      parseResponse(apiClient["status-pages"].$post({ json: payload })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privateKey("status-pages"),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("settings") });
    },
  });
}

export function useUpdateStatusPageMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: StatusPagePayload) =>
      parseResponse(
        apiClient["status-pages"][":id"].$put({ param: { id }, json: payload }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privateKey("status-pages"),
      });
      await queryClient.invalidateQueries({
        queryKey: privateKey("status-pages", id),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("settings") });
    },
  });
}

export function useDeleteStatusPageMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      parseResponse(
        apiClient["status-pages"][":id"].$delete({ param: { id } }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privateKey("status-pages"),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("settings") });
    },
  });
}
