import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { logger } from "void/log";

import { AppError } from "@/lib/errors";
import { m } from "@/paraglide/messages.js";

/**
 * Registered for every server function in `src/start.ts`. `AppError`s and
 * router control flow (`notFound()`, `redirect()`) reach the client as
 * thrown; anything else is an internal failure, so it is logged in full and
 * the client only sees a generic message.
 */
export const errorMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof AppError || isNotFound(error) || isRedirect(error)) {
        throw error;
      }

      logger.error("server function failed", {
        error: error instanceof Error ? error.stack : String(error),
      });

      throw new AppError(m.error_unexpected());
    }
  },
);
