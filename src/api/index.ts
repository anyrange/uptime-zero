import { evlog } from "evlog/hono";
import { initWorkersLogger } from "evlog/workers";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "@/ctx";

import { authApi } from "@/api/controllers/auth";
import { dashboardApi } from "@/api/controllers/dashboard";
import { monitorsApi } from "@/api/controllers/monitors";
import { notificationsApi } from "@/api/controllers/notifications";
import { registerPushRoutes } from "@/api/controllers/push";
import { settingsApi } from "@/api/controllers/settings";
import {
  publicStatusApi,
  statusPagesApi,
} from "@/api/controllers/status-pages";
import { createAppDb } from "@/api/db";
import { MonitorActor } from "@/api/durable/monitor-actor";
import { runDueMonitorBatch } from "@/api/lib/monitoring-scheduler";
import { loadSession } from "@/api/middleware/auth";
import { requireApiAdmin, requireApiSession } from "@/api/middleware/guards";

initWorkersLogger({
  env: { service: "uptime-worker" },
  sampling: {
    rates: {
      info: 25,
      warn: 100,
      error: 100,
    },
  },
});

export const api = new Hono<AppEnv>()
  .route("/auth", authApi)
  .route("/status", publicStatusApi)
  .use("*", requireApiSession)
  .route("/dashboard", dashboardApi)
  .route("/monitors", monitorsApi)
  .use("/settings", requireApiAdmin)
  .use("/settings/*", requireApiAdmin)
  .route("/settings", settingsApi)
  .use("/status-pages", requireApiAdmin)
  .use("/status-pages/*", requireApiAdmin)
  .route("/status-pages", statusPagesApi)
  .use("/notifications", requireApiAdmin)
  .use("/notifications/*", requireApiAdmin)
  .route("/notifications", notificationsApi);

export type ApiType = typeof api;

const app = new Hono<AppEnv>();

app.use("*", evlog());
app.use("*", loadSession);
app.onError((error, ctx) => {
  const status = error instanceof HTTPException ? error.status : 500;
  const message =
    error instanceof HTTPException ? error.message : "Internal server error";
  ctx
    .get("log")
    .error(error instanceof Error ? error : new Error(String(error)));
  return ctx.json({ error: message }, status);
});

registerPushRoutes(app);
app.route("/api", api);

export { MonitorActor };

const worker: ExportedHandler<Env> = {
  fetch(request, env, executionCtx) {
    return app.fetch(request, env, executionCtx);
  },
  async scheduled(_controller, env, executionCtx) {
    const db = createAppDb(env.DB);
    executionCtx.waitUntil(runDueMonitorBatch(db));
  },
};

export default worker;
