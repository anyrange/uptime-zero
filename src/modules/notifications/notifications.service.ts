import "@tanstack/react-start/server-only";
import { notFound } from "@tanstack/react-router";
import { waitUntil } from "cloudflare:workers";
import dayjs from "dayjs";
import { logger } from "void/log";

import type {
  NotificationDestinationDetail,
  NotificationDestinationSummary,
  NotificationInput,
} from "@/lib/schemas/notifications";

import { AppError } from "@/lib/errors";
import * as monitorsRepo from "@/modules/monitors/monitors.repository";
import { m } from "@/paraglide/messages.js";

import * as repo from "./notifications.repository";
import { deliverNotification } from "./providers";

/**
 * Notification use cases: managing destinations, test sends, and draining the
 * delivery outbox. Delivery is at least once; each intent retries on its own
 * backoff without blocking the others.
 */

const DELIVERY_BATCH_SIZE = 2;

const MAX_RETRY_DELAY_MS = 3_600_000;

/** Exponential backoff from 30s, capped at one hour. */
function retryDelayMs(attempts: number) {
  return Math.min(MAX_RETRY_DELAY_MS, 30_000 * 2 ** Math.min(attempts - 1, 7));
}

/** Every destination with its assigned monitors, plus the assignable ones. */
export async function list() {
  const [destinations, assignments, monitors] = await Promise.all([
    repo.list(),
    repo.assignments(null),
    repo.listAssignableMonitors(),
  ]);

  return {
    destinations: destinations.map(
      (destination): NotificationDestinationSummary => ({
        ...destination,
        assignedMonitors: assignments.get(destination.id) ?? [],
      }),
    ),
    monitors,
  };
}

export const destinations = repo.list;

export async function detail(
  id: string,
): Promise<NotificationDestinationDetail> {
  const [destination, assignments] = await Promise.all([
    repo.findById(id),
    repo.assignments([id]),
  ]);

  if (!destination) throw notFound();

  return {
    ...destination,
    monitorIds: (assignments.get(id) ?? []).map((monitor) => monitor.id),
  };
}

export const forMonitor = repo.listForMonitor;

async function requireKnownMonitors(input: NotificationInput) {
  const missing = await repo.missingMonitorIds(input.monitorIds);

  if (missing.length > 0) {
    throw new AppError(
      m.notification_unknown_monitors({ ids: missing.join(", ") }),
    );
  }
}

export async function create(input: NotificationInput) {
  await requireKnownMonitors(input);

  return detail(await repo.save(input));
}

export async function update(id: string, input: NotificationInput) {
  if (!(await repo.findById(id))) throw notFound();

  await requireKnownMonitors(input);
  await repo.save(input, id);

  return detail(id);
}

export const remove = repo.remove;

/** Sends a test event; a delivery failure reaches the caller as `AppError`. */
export async function sendTest(id: string) {
  const destination = await repo.findById(id);

  if (!destination) throw notFound();

  await deliverNotification(destination, {
    kind: "test",
    sentAt: dayjs().toISOString(),
    destination: {
      id: destination.id,
      name: destination.name,
      provider: destination.provider,
    },
  });
}

async function deliverIntent(intent: repo.DeliveryIntent) {
  const [destination, monitor] = await Promise.all([
    repo.findById(intent.destinationId),
    monitorsRepo.findById(intent.monitorId),
  ]);

  // Both cascade-delete their intents, so a missing one is a race.
  if (!destination || !monitor) return;

  await deliverNotification(destination, {
    kind: "transition",
    monitor,
    status: intent.status,
    checkedAt: intent.checkedAt,
    error: intent.error,
  });

  await repo.markDelivered(intent, Date.now());
}

async function retryLater(intent: repo.DeliveryIntent, cause: unknown) {
  const attempts = intent.attempts + 1;

  await repo.reschedule(intent, attempts, Date.now() + retryDelayMs(attempts));

  logger.warn("notification delivery will retry", {
    deliveryId: intent.id,
    attempts,
    error: cause instanceof Error ? cause.message : String(cause),
  });
}

/** Sends the next due alerts; a failed send only reschedules itself. */
export async function deliverDue() {
  const due = await repo.listDueIntents(Date.now(), DELIVERY_BATCH_SIZE);

  await Promise.all(
    due.map((intent) =>
      // Any failure, including a bug, only reschedules this intent.
      deliverIntent(intent).catch((cause: unknown) =>
        retryLater(intent, cause),
      ),
    ),
  );
}

/**
 * Sends alerts a request just committed (a first check, a push recovery)
 * without waiting for the next cron run. Nobody awaits it, so a failure is
 * only logged; the outbox cron retries the intents.
 */
export function deliverDueAfterResponse() {
  waitUntil(
    deliverDue().catch((error: Error) => {
      logger.error("notification delivery failed", { error: error.stack });
    }),
  );
}
