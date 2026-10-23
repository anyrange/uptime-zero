import { z } from "zod";

import { m } from "@/paraglide/messages.js";

const RetentionDays = z
  .int()
  .min(1, { error: () => m.validation_min_one_day() })
  .max(365, { error: () => m.validation_max_365_days() });

/** How long check history and closed incidents are kept. */
export const RetentionSettings = z.object({
  heartbeatRetentionDays: RetentionDays,
  incidentRetentionDays: RetentionDays,
});

export type RetentionSettings = z.infer<typeof RetentionSettings>;
