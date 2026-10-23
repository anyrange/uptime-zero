import "@tanstack/react-start/server-only";
import { notFound } from "@tanstack/react-router";
import { waitUntil } from "cloudflare:workers";
import dayjs from "dayjs";

import type { StatusPage, StatusPageInput } from "@/lib/schemas/status-pages";

import * as incidents from "@/modules/incidents/incidents.service";
import { aggregateStatus } from "@/modules/monitors/schedule";
import * as settings from "@/modules/settings/settings.service";

import * as repo from "./status-pages.repository";

/** Status page use cases, including the anonymous public view. */

/** Browsers may reuse a public page for 15s, the edge for 30s. */
export const PUBLIC_STATUS_CACHE_CONTROL =
  "public, max-age=15, s-maxage=30, stale-while-revalidate=30";

const MAX_HISTORY_DAYS = 365;

const MAX_UPTIME_DAYS = 90;

const PUBLIC_INCIDENT_LIMIT = 10;

/** Start of the UTC day `days` ago, as an ISO timestamp. */
function startOfDayAgo(days: number) {
  return `${dayjs().subtract(days, "day").toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export const list = repo.list;

export const links = repo.listLinks;

export async function detail(id: string) {
  const found = await repo.findById(id);

  if (!found) throw notFound();

  return found;
}

export async function create(input: StatusPageInput) {
  return detail(await repo.save(input));
}

export async function update(id: string, input: StatusPageInput) {
  await detail(id);
  await repo.save(input, id);

  return detail(id);
}

export const remove = repo.remove;

/**
 * Builds what an anonymous visitor sees. Only safe fields leave here:
 * targets are opt-in and incident bodies, which may contain private
 * targets or assertion values, are always stripped.
 */
async function buildPublicPage(page: StatusPage) {
  const { heartbeatRetentionDays } = await settings.current();
  const historyDays = Math.min(heartbeatRetentionDays, MAX_HISTORY_DAYS);
  const monitors = await repo.publicMonitors(page);
  const monitorIds = monitors.map((monitor) => monitor.id);

  // A page without monitors has nothing to aggregate.
  const loaded =
    monitorIds.length === 0
      ? null
      : await Promise.all([
          page.showHistory
            ? repo.dailyCounts(
                monitorIds,
                dayjs().subtract(historyDays, "day").toISOString(),
              )
            : [],
          repo.uptimeCounts(monitorIds, {
            since: startOfDayAgo(Math.min(historyDays, MAX_UPTIME_DAYS)),
            day: startOfDayAgo(0),
            week: startOfDayAgo(6),
            month: startOfDayAgo(29),
          }),
          incidents.forMonitors(monitorIds, PUBLIC_INCIDENT_LIMIT),
        ]);

  return {
    page,
    monitors,
    incidents: (loaded?.[2] ?? []).map((incident) => ({
      ...incident,
      body: null,
    })),
    history: loaded?.[0] ?? [],
    uptime: loaded?.[1] ?? [],
    historyDays,
    status: aggregateStatus(monitors.map((monitor) => monitor.lastStatus)),
  };
}

type PublicPage = Awaited<ReturnType<typeof buildPublicPage>>;

/**
 * The published page for `slug`, served from the colo cache for a few
 * seconds so a busy page doesn't turn every visit into D1 aggregates.
 */
export async function publicPage(slug: string): Promise<PublicPage> {
  const cache = await caches.open("public-status");

  const cacheKey = new Request(
    `https://public-status.internal/${encodeURIComponent(slug)}`,
  );

  const cached = await cache.match(cacheKey);

  if (cached) return cached.json<PublicPage>();

  const page = await repo.findPublishedBySlug(slug);

  if (!page) throw notFound();

  const view = await buildPublicPage(page);

  waitUntil(
    cache.put(
      cacheKey,
      Response.json(view, {
        headers: { "Cache-Control": PUBLIC_STATUS_CACHE_CONTROL },
      }),
    ),
  );

  return view;
}
