import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { createPermix } from "permix";

import type { AppEnv } from "@/ctx";
import type { AppPermissionPath } from "@/lib/permissions";

import {
  type AppPermissionsDefinition,
  getPermissionRules,
} from "@/lib/permissions";

export function requireApiPermission(path: AppPermissionPath) {
  return createMiddleware<AppEnv>(async (ctx, next) => {
    if (!ctx.get("sessionUserId")) {
      throw new HTTPException(401, { message: "Authentication required" });
    }

    const permix = createPermix<AppPermissionsDefinition>();
    permix.setup(getPermissionRules(ctx.get("sessionUserRole")));

    if (!permix.check(path)) {
      throw new HTTPException(403, { message: "Permission denied" });
    }

    await next();
  });
}
