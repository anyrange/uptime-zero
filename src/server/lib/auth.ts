import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env as runtimeEnv } from "cloudflare:workers";

import { getDrizzle } from "@/server/db";

type AuthEnv = {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
};

type AuthOptions = {
  baseURL?: string;
};

export function createAuth(env: AuthEnv, options: AuthOptions = {}) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: options.baseURL ?? env.BETTER_AUTH_URL,
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
          input: false,
        },
      },
    },
    advanced: {
      cookiePrefix: "uptime",
    },
  });
}

export const auth = createAuth(runtimeEnv as AuthEnv);

export function authFor(ctx: { env: AuthEnv; req: { url: string } }) {
  return createAuth(ctx.env, {
    baseURL: ctx.env.BETTER_AUTH_URL ?? new URL(ctx.req.url).origin,
  });
}
