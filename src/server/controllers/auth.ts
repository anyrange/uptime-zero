import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { AppEnv } from "@/ctx";

import { createDatabase } from "@/server/db";
import { authFor } from "@/server/lib/auth";
import { requireApiPermission } from "@/server/middleware/permissions";

const authCredentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const setupPayloadSchema = authCredentialsSchema.extend({
  name: z.string().trim().min(1),
});

const updateAccountPayloadSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
});

export const authApi = new Hono<AppEnv>()
  .get("/setup-state", async (ctx) => {
    const db = createDatabase(ctx.env.DB);

    const setupState = await db.user.getSetupState();

    return ctx.json(setupState);
  })
  .get("/session", async (ctx) =>
    ctx.json({
      user: ctx.get("sessionUserId")
        ? {
            id: ctx.get("sessionUserId"),
            name: ctx.get("sessionUserName"),
            email: ctx.get("sessionUserEmail"),
            image: ctx.get("sessionUserImage"),
            role: ctx.get("sessionUserRole"),
          }
        : null,
    }),
  )
  .post("/setup", zValidator("json", setupPayloadSchema), async (ctx) => {
    const { name, email, password } = ctx.req.valid("json");

    const db = createDatabase(ctx.env.DB);

    const usersCount = await db.user.countUsers();
    if (usersCount > 0) {
      throw new HTTPException(409, { message: "Admin already exists" });
    }

    const response = await authFor(ctx).api.signUpEmail({
      body: { name, email, password },
      headers: ctx.req.raw.headers,
      asResponse: true,
    });

    if (!response.ok) {
      throw new HTTPException(400, { message: await response.text() });
    }

    const user = await db.user.findUserByEmail(email);
    if (user) {
      await db.user.promoteUserToAdmin(user.id);
    }

    return jsonWithAuthCookies(response, { ok: true });
  })
  .post("/login", zValidator("json", authCredentialsSchema), async (ctx) => {
    const { email, password } = ctx.req.valid("json");

    const response = await authFor(ctx).api.signInEmail({
      body: { email, password, rememberMe: true },
      headers: ctx.req.raw.headers,
      asResponse: true,
    });

    if (!response.ok) {
      throw new HTTPException(401, { message: "Invalid credentials" });
    }

    return jsonWithAuthCookies(response, { ok: true });
  })
  .post("/logout", async (ctx) => {
    const response = await authFor(ctx).api.signOut({
      headers: ctx.req.raw.headers,
      asResponse: true,
    });

    return jsonWithAuthCookies(response, { ok: true });
  })
  .get("/account", async (ctx) => {
    const userId = ctx.get("sessionUserId");

    if (!userId) {
      throw new HTTPException(401, { message: "Authentication required" });
    }

    const db = createDatabase(ctx.env.DB);
    const account = await db.user.getAccount(userId);

    if (!account) {
      throw new HTTPException(404, { message: "Account not found" });
    }

    return ctx.json(account);
  })
  .put(
    "/account",
    zValidator("json", updateAccountPayloadSchema),
    async (ctx) => {
      const userId = ctx.get("sessionUserId");

      if (!userId) {
        throw new HTTPException(401, { message: "Authentication required" });
      }

      const { name } = ctx.req.valid("json");
      const db = createDatabase(ctx.env.DB);

      const account = await db.user.updateAccountName(userId, name);
      if (!account) {
        throw new HTTPException(404, { message: "Account not found" });
      }

      return ctx.json(account);
    },
  )
  .delete(
    "/account",
    requireApiPermission("account.deleteWorkspace"),
    async (ctx) => {
      const userId = ctx.get("sessionUserId");

      if (!userId) {
        throw new HTTPException(401, { message: "Authentication required" });
      }

      const db = createDatabase(ctx.env.DB);
      await db.user.deleteUserAndWorkspaceData(userId);

      return ctx.json({ ok: true });
    },
  );

function jsonWithAuthCookies(source: Response, body: { ok: boolean }) {
  const headers = new Headers(source.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body), {
    status: 200,
    headers,
  });
}
