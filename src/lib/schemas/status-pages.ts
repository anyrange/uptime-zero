import type * as schema from "@schema";

import { z } from "zod";

import { m } from "@/paraglide/messages.js";

/** A public page showing the health of selected monitors. */
export type StatusPage = typeof schema.statusPages.$inferSelect;

/** Public pages list at most this many monitors. */
export const MAX_STATUS_PAGE_MONITORS = 90;

export const StatusPageInput = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: () => m.status_page_title_required() }),
  slug: z
    .string()
    .trim()
    .min(1, { error: () => m.status_page_slug_required() }),
  description: z.string().trim().nullable().default(null),
  published: z.boolean(),
  showHistory: z.boolean(),
  /** Whether visitors may see monitor targets (URLs, hostnames). */
  showTarget: z.boolean().default(false),
  monitorIds: z
    .array(z.string())
    .max(MAX_STATUS_PAGE_MONITORS, {
      error: () => m.status_page_monitors_maximum(),
    })
    .default([]),
});

export type StatusPageInput = z.infer<typeof StatusPageInput>;

/** What forms hold and the server function accepts, before defaults apply. */
export type StatusPageInputEncoded = z.input<typeof StatusPageInput>;
