import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { env } from "cloudflare:workers";

import { getDb } from "@/api/db";
import * as schema from "@/api/db/schema";
import worker from "@/api/index";

export async function setupAdminSession() {
  const response = await apiFetch("/api/auth/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Admin",
      email: "admin@example.com",
      password: "password-123456",
    }),
  });

  if (response.status !== 200) {
    throw new Error(`Failed to setup admin session: ${response.status}`);
  }

  return response.headers.get("set-cookie") ?? "";
}

export async function downgradeAdminToUser() {
  await getDb(env.DB).update(schema.user).set({ role: "user" });
}

export async function seedMonitorWithHeartbeats(count: number) {
  const db = getDb(env.DB);
  const monitorId = crypto.randomUUID();
  const now = "2026-05-01T12:00:00.000Z";

  await db.insert(schema.monitors).values({
    id: monitorId,
    name: "API",
    kind: "http",
    target: "https://example.com/health",
    intervalSec: 60,
    timeoutMs: 10000,
    retries: 0,
    assertionsJson: "[]",
    pushToken: null,
    active: 1,
    lastStatus: "up",
    lastCheckedAt: now,
    lastDurationMs: 123,
    lastError: null,
    lastCertValidTo: null,
    lastCertDaysRemaining: null,
    lastCertHostname: null,
    lastSslStatus: null,
    createdAt: now,
    updatedAt: now,
  });

  for (const heartbeat of Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    monitorId,
    status: index % 5 === 0 ? "down" : "up",
    statusCode: index % 5 === 0 ? 500 : 200,
    durationMs: 100 + index,
    error: index % 5 === 0 ? "HTTP 500" : null,
    certDaysRemaining: null,
    createdAt: new Date(Date.UTC(2026, 4, 1, 12, index, 0)).toISOString(),
    source: "scheduled",
  }))) {
    await db.insert(schema.heartbeats).values(heartbeat);
  }

  return monitorId;
}

export async function apiFetch(path: string, init?: RequestInit | string) {
  const requestInit =
    typeof init === "string" ? { headers: { cookie: init } } : init;
  const ctx = createExecutionContext();

  const response = await worker.fetch!(
    new Request(`http://localhost${path}`, requestInit) as Parameters<
      NonNullable<typeof worker.fetch>
    >[0],
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  await new Promise((resolve) => setTimeout(resolve, 25));
  return response;
}
