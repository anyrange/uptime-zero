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
import { NotificationActor } from "@/server/durable/notification-actor";
import {
  getSchedulerActor,
  SchedulerActor,
} from "@/server/durable/scheduler-actor";
import { loadSession } from "@/server/middleware/auth";
import { requireApiSession } from "@/server/middleware/guards";
import { requireApiPermission } from "@/server/middleware/permissions";
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
  .use("/dashboard", requireApiPermission("monitor.read"))
  .route("/dashboard", dashboardApi)
  .use("/monitors", requireApiPermission("monitor.read"))
  .use("/monitors/*", requireApiPermission("monitor.read"))
  .route("/monitors", monitorsApi)
  .use("/settings", requireApiPermission("settings.read"))
  .use("/settings/*", requireApiPermission("settings.read"))
  .route("/settings", settingsApi)
  .use("/status-pages", requireApiPermission("statusPage.read"))
  .use("/status-pages/*", requireApiPermission("statusPage.read"))
  .route("/status-pages", statusPagesApi)
  .use("/notifications", requireApiPermission("notification.read"))
  .use("/notifications/*", requireApiPermission("notification.read"))
  .route("/notifications", notificationsApi);

export type ApiType = typeof api;

const app = new Hono<AppEnv>();

app.use("*", evlog());

app.use("*", async (ctx, next) => {
  if (ctx.req.path.startsWith("/api/push/"))
    ctx.get("log").set({ path: "/api/push/:token" });
  await next();
});

app.use("/api/*", async (ctx, next) => {
  if (
    ctx.req.path.startsWith("/api/push/") ||
    ctx.req.path.startsWith("/api/status/")
  )
    return next();

  return loadSession(ctx, next);
});

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

export { SchedulerActor, NotificationActor };

const worker: ExportedHandler<Env> = {
  fetch(request, env, executionCtx) {
    return app.fetch(request, env, executionCtx);
  },
  async scheduled(controller, env) {
    if (controller.cron === "* * * * *") {
      await Promise.all([
        getSchedulerActor(env).sync("reconcile"),
        env.NOTIFICATION_ACTOR.getByName("installation").sync(),
      ]);

      return;
    }

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
