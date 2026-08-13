import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { testUtils } from "better-auth/plugins";
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import { z } from "zod";

import { getDrizzle } from "@/server/db";
import * as schema from "@/server/db/schema";
import worker from "@/server/index";

export const testAuth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: "http://localhost",
  database: drizzleAdapter(getDrizzle(env.DB), {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: ["user", "admin"],
        required: false,
        defaultValue: "user",
        input: true,
      },
    },
  },
  advanced: {
    cookiePrefix: "uptime",
  },
  plugins: [testUtils()],
});

export async function seedMonitorWithHeartbeats(count: number) {
  const db = getDrizzle(env.DB);

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
    createdAt: new Date(Date.UTC(2026, 4, 1, 12, index, 0)).toISOString(),
    source: "scheduled",
  }))) {
    await db.insert(schema.heartbeats).values(heartbeat);
  }

  return monitorId;
}

export async function apiFetch(path: string, init?: RequestInit | string) {
  const stringInit = z.string().safeParse(init);
  const requestInit = stringInit.success
    ? { headers: { cookie: stringInit.data } }
    : init instanceof Object
      ? init
      : undefined;
  const ctx = createExecutionContext();

  // SAFETY: The worker test pool supplies a runtime Request compatible with the Workerd request type.
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
