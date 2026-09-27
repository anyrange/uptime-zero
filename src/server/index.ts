import { honoLogLayer } from "@loglayer/hono";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "@/ctx";

import { createDatabase } from "@/server/db";
import { NotificationActor } from "@/server/durable/notification-actor";
import {
  getSchedulerActor,
  SchedulerActor,
} from "@/server/durable/scheduler-actor";
import { logger } from "@/server/lib/logger";
import { loadSession } from "@/server/middleware/auth";
import { requireApiSession } from "@/server/middleware/guards";
import { requireApiPermission } from "@/server/middleware/permissions";
import { authApi } from "@/server/routes/auth";
import { dashboardApi } from "@/server/routes/dashboard";
import { monitorsApi } from "@/server/routes/monitors";
import { notificationsApi } from "@/server/routes/notifications";
import { pushApi } from "@/server/routes/push";
import { settingsApi } from "@/server/routes/settings";
import { publicStatusApi, statusPagesApi } from "@/server/routes/status-pages";
import { MaintenanceService } from "@/server/services/maintenance";

// Registration order is the access boundary: public routes respond before the
// session middleware runs, and `/auth` needs a loaded but optional session.
export const api = new Hono<AppEnv>()
  .route("/status", publicStatusApi)
  .route("/push", pushApi)
  .use(loadSession)
  .route("/auth", authApi)
  .use(requireApiSession)
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

const app = new Hono<AppEnv>()
  .use(
    honoLogLayer({
      instance: logger,
      requestId: (request) =>
        request.headers.get("cf-ray") ?? crypto.randomUUID(),
      // One line per request; handlers enrich it through `logger.withContext`.
      autoLogging: { request: false, ignore: [/^\/api\/push\//] },
    }),
  )
  .route("/api", api);

app.onError((error, ctx) => {
  const status = error instanceof HTTPException ? error.status : 500;

  const message =
    error instanceof HTTPException ? error.message : "Internal server error";

  ctx.get("logger").withError(error).error("request failed");

  return ctx.json({ error: message }, status);
});

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
    logger
      .withMetadata({
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
      })
      .info("maintenance cleanup completed");
  },
};

export default worker;
