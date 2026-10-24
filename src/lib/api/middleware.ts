import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { AppError } from "@/lib/errors";
import { type Capability, can } from "@/lib/permissions";
import { getAuth, toSessionUser } from "@/modules/auth/better-auth";
import { m } from "@/paraglide/messages.js";

/** Resolves the Better Auth session; anonymous requests get `user: null`. */
export const sessionMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const session = await getAuth().api.getSession({
      headers: getRequestHeaders(),
    });

    return next({
      context: { user: session ? toSessionUser(session.user) : null },
    });
  },
);

export const authenticatedMiddleware = createMiddleware({ type: "function" })
  .middleware([sessionMiddleware])
  .server(async ({ context, next }) => {
    if (!context.user) throw new AppError(m.error_unauthenticated());

    return next({ context: { user: context.user } });
  });

/**
 * The authorization boundary for private server functions. Route guards only
 * shape navigation; every private function must carry one of these.
 */
export function permissionMiddleware(capability: Capability) {
  return createMiddleware({ type: "function" })
    .middleware([authenticatedMiddleware])
    .server(async ({ context, next }) => {
      if (!can(context.user.role, capability)) {
        throw new AppError(m.error_forbidden());
      }

      return next();
    });
}
