import { createStart } from "@tanstack/react-start";

import { errorMiddleware } from "@/lib/api/error-middleware";

// Start loads this entry alongside the router, so it imports only the
// dependency-light error middleware; pulling in the session middleware (and
// Better Auth) here races the router's own import of it in dev.
export const startInstance = createStart(() => ({
  functionMiddleware: [errorMiddleware],
}));
