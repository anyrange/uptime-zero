import type { EvlogVariables } from "evlog/hono";

import type { MonitorActor } from "@/api/durable/monitor-actor";

export type Bindings = Env & {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
};

export type Variables = {
  sessionUserId: string | null;
  sessionUserRole: "admin" | "user" | null;
  sessionUserName: string | null;
  sessionUserEmail: string | null;
  sessionUserImage: string | null;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables & EvlogVariables["Variables"];
};
