import type * as schema from "@schema";

import { z } from "zod";

/** A monitor's outage, opened by the first failed check and closed on recovery. */
export type Incident = typeof schema.incidents.$inferSelect;

export const IncidentFilters = z.object({
  status: z.enum(["open", "closed", "all"]).optional(),
  monitor: z.string().optional(),
  q: z.string().optional(),
});

export type IncidentFilters = z.infer<typeof IncidentFilters>;
