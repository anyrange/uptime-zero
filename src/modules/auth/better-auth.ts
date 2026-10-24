import "@tanstack/react-start/server-only";
import * as schema from "@schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { count, db } from "void/db";
import { env } from "void/env";

import type { SessionUser } from "@/lib/schemas/auth";

import { roleOf } from "@/modules/accounts/accounts.repository";

/**
 * Better Auth is mounted at `/api/auth/*` and is the only way to create
 * users. The installation has exactly one account: the first sign-up becomes
 * the admin and every later sign-up is rejected. The unique admin index in
 * the schema settles concurrent setups.
 */
function createAuth() {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // The UI and the auth handler share one Worker origin, so same-origin
    // requests are trusted even when `BETTER_AUTH_URL` names another host
    // (local dev ports, previews). Cross-site origins are still rejected.
    trustedOrigins: (request) => (request ? [new URL(request.url).origin] : []),
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: { enabled: true },
    // Better Auth only enables this when NODE_ENV is "production", which the
    // Worker doesn't set. Limits are kept per isolate, which is enough to blunt
    // credential guessing without spending D1 writes.
    rateLimit: { enabled: true },
    user: {
      additionalFields: {
        role: {
          type: ["user", "admin"],
          required: false,
          defaultValue: "user",
          input: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const [row] = await db.select({ count: count() }).from(schema.user);

            if ((row?.count ?? 0) > 0) {
              throw new APIError("CONFLICT", {
                message: "Admin already exists",
              });
            }

            return { data: { ...user, role: "admin" } };
          },
        },
      },
    },
    advanced: { cookiePrefix: "uptime" },
    // Must stay last: it forwards Better Auth cookies through Start responses.
    plugins: [tanstackStartCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/**
 * Builds Better Auth on first use. Deployed Workers only expose Void's `env`
 * once a request is running, so reading secrets at module load throws and
 * poisons the module for the whole isolate.
 */
export function getAuth() {
  return (instance ??= createAuth());
}

export function toSessionUser(user: {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    role: roleOf(user.role),
  };
}
