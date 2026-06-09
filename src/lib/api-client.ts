import { hc } from "hono/client";

import type { ApiType } from "@/server";

export const apiClient = hc<ApiType>("/api", {
  init: {
    credentials: "include",
  },
});

export { DetailedError, parseResponse } from "hono/client";
