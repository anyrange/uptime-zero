import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { auth } from "@/modules/auth/better-auth";

// Credential endpoints are throttled per client IP before Better Auth runs.
const RATE_LIMITED_PATHS = new Set([
  "/api/auth/sign-in/email",
  "/api/auth/sign-up/email",
]);

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: async ({ request }) => {
        if (RATE_LIMITED_PATHS.has(new URL(request.url).pathname)) {
          const { success } = await env.AUTH_RATE_LIMIT.limit({
            key: request.headers.get("cf-connecting-ip") ?? "local",
          });

          if (!success) {
            return Response.json(
              { message: "Too many attempts. Try again shortly." },
              { status: 429, headers: { "Retry-After": "60" } },
            );
          }
        }

        return auth.handler(request);
      },
    },
  },
});
