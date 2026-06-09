import { evlog } from "evlog/hono";
import { initWorkersLogger } from "evlog/workers";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "@/ctx";

import { authApi } from "@/server/controllers/auth";
import { dashboardApi } from "@/server/controllers/dashboard";
import { monitorsApi } from "@/server/controllers/monitors";
import { notificationsApi } from "@/server/controllers/notifications";
import { registerPushRoutes } from "@/server/controllers/push";
import { settingsApi } from "@/server/controllers/settings";
import {
  publicStatusApi,
  statusPagesApi,
} from "@/server/controllers/status-pages";
import { createDatabase } from "@/server/db";
import { SchedulerActor } from "@/server/durable/scheduler-actor";
import { loadSession } from "@/server/middleware/auth";
import { requireApiAdmin, requireApiSession } from "@/server/middleware/guards";
import { MaintenanceService } from "@/server/services/maintenance";

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

export { SchedulerActor };

const worker: ExportedHandler<Env> = {
  fetch(request, env, executionCtx) {
    return app.fetch(request, env, executionCtx);
  },
  async scheduled(controller, env) {
    const db = createDatabase(env.DB);
    const maintenance = new MaintenanceService(db);

    await maintenance.cleanupRetention();
    console.info("maintenance cleanup completed", {
      cron: controller.cron,
      scheduledTime: controller.scheduledTime,
    });
  },
};

export default worker;
