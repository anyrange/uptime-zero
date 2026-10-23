import { z } from "zod";

import { m } from "@/paraglide/messages.js";

export const ProfileInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: () => m.validation_name_required() })
    .max(120, { error: () => m.validation_name_too_long() }),
});
