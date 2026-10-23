import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { privateKey } from "@/lib/api/keys";
import { permissionMiddleware } from "@/lib/api/middleware";
import {
  StatusPageInput,
  type StatusPageInputEncoded,
} from "@/lib/schemas/status-pages";
import * as monitors from "@/modules/monitors/monitors.service";
import * as statusPages from "@/modules/status-pages/status-pages.service";

const ById = z.object({ id: z.string() });

export const listStatusPages = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("statusPage.read")])
  .handler(async () => {
    const [pages, allMonitors, links] = await Promise.all([
      statusPages.list(),
      monitors.all(),
      statusPages.links(),
    ]);

    return { pages, monitors: allMonitors, links };
  });

/** A page with its linked monitors, plus every monitor for the editor. */
export const getStatusPage = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("statusPage.read")])
  .validator(ById)
  .handler(async ({ data }) => {
    const [detail, allMonitors] = await Promise.all([
      statusPages.detail(data.id),
      monitors.all(),
    ]);

    return { ...detail, monitors: allMonitors };
  });

export const createStatusPage = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("statusPage.create")])
  .validator(StatusPageInput)
  .handler(({ data }) => statusPages.create(data));

export const updateStatusPage = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("statusPage.update")])
  .validator(z.object({ id: z.string(), input: StatusPageInput }))
  .handler(({ data }) => statusPages.update(data.id, data.input));

export const deleteStatusPage = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("statusPage.delete")])
  .validator(ById)
  .handler(({ data }) => statusPages.remove(data.id));

/** Anonymous read of a published page; identical for every visitor. */
export const getPublicStatusPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(({ data }) => {
    setResponseHeader("cache-control", statusPages.PUBLIC_STATUS_CACHE_CONTROL);

    return statusPages.publicPage(data.slug);
  });

/**
 * Everything an anonymous visitor may see. Built only from fields that are
 * safe to publish: targets are opt-in and incident bodies are never included.
 */
export type PublicStatusPage = Awaited<ReturnType<typeof getPublicStatusPage>>;

export function statusPagesQueryOptions() {
  return queryOptions({
    queryKey: privateKey("status-pages"),
    queryFn: () => listStatusPages(),
  });
}

export function statusPageQueryOptions(id: string) {
  return queryOptions({
    queryKey: privateKey("status-pages", id),
    queryFn: () => getStatusPage({ data: { id } }),
  });
}

export function publicStatusPageQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["public-status", slug],
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: () => getPublicStatusPage({ data: { slug } }),
  });
}

export function useCreateStatusPageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: StatusPageInputEncoded) =>
      createStatusPage({ data: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privateKey("status-pages"),
      });
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("settings") });
    },
  });
}

export function useUpdateStatusPageMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: StatusPageInputEncoded) =>
      updateStatusPage({ data: { id, input: payload } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privateKey("status-pages"),
      });
      await queryClient.invalidateQueries({
        queryKey: privateKey("status-pages", id),
      });
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("settings") });
    },
  });
}

export function useDeleteStatusPageMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteStatusPage({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privateKey("status-pages"),
      });
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("settings") });
    },
  });
}
