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
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // The UI and the auth handler share one Worker origin, so same-origin
  // requests are trusted even when `BETTER_AUTH_URL` names another host
  // (local dev ports, previews). Cross-site origins are still rejected.
  trustedOrigins: (request) => (request ? [new URL(request.url).origin] : []),
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: { enabled: true },
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
            throw new APIError("CONFLICT", { message: "Admin already exists" });
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
