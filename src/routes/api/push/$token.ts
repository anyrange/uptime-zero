import { createFileRoute } from "@tanstack/react-router";
import { logger } from "void/log";

import * as monitors from "@/modules/monitors/monitors.service";
import * as notifications from "@/modules/notifications/notifications.service";

/**
 * Heartbeat endpoint for push monitors, called by cron jobs and scripts. The
 * token is the credential, so logs only carry its last characters.
 */
export const Route = createFileRoute("/api/push/$token")({
  server: {
    handlers: {
      POST: async ({ params: { token } }) => {
        const monitor = await monitors.recordHeartbeat(token);

        if (!monitor) {
          return Response.json(
            { error: "Heartbeat monitor not found" },
            { status: 404 },
          );
        }

        logger.info("push heartbeat recorded", {
          monitorId: monitor.id,
          tokenSuffix: token.slice(-8),
        });

        // A recovery may have committed an alert; send it right away.
        notifications.deliverDueAfterResponse();

        return Response.json({ ok: true });
      },
    },
  },
});
