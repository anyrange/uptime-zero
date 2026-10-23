import "@tanstack/react-start/server-only";
import * as schema from "@schema";
import { count, db, desc, eq } from "void/db";

import { Role } from "@/lib/schemas/auth";

/** Read access to Better Auth's user tables, and the workspace reset. */

export async function countUsers() {
  const [row] = await db.select({ count: count() }).from(schema.user);

  return row?.count ?? 0;
}

export async function findAccount(userId: string) {
  const [user] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, userId));

  if (!user) return null;

  const [accounts, sessions] = await Promise.all([
    db
      .select({
        id: schema.account.id,
        providerId: schema.account.providerId,
        accountId: schema.account.accountId,
        createdAt: schema.account.createdAt,
        updatedAt: schema.account.updatedAt,
      })
      .from(schema.account)
      .where(eq(schema.account.userId, userId)),
    db
      .select({
        id: schema.session.id,
        expiresAt: schema.session.expiresAt,
        ipAddress: schema.session.ipAddress,
        userAgent: schema.session.userAgent,
        createdAt: schema.session.createdAt,
        updatedAt: schema.session.updatedAt,
      })
      .from(schema.session)
      .where(eq(schema.session.userId, userId))
      .orderBy(desc(schema.session.updatedAt)),
  ]);

  // Dates are serialized here so the shape matches what clients receive.
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: roleOf(user.role),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    accounts: accounts.map((account) => ({
      ...account,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    })),
    sessions: sessions.map((session) => ({
      ...session,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    })),
  };
}

// The installation has a single workspace owned by its admin, so deleting
// the admin resets everything back to the setup screen. One D1 batch, so it
// commits or rolls back as a whole.
export async function deleteWithWorkspace(userId: string) {
  await db.batch([
    db.delete(schema.monitors),
    db.delete(schema.notificationDestinations),
    db.delete(schema.statusPages),
    db.delete(schema.appSettings),
    db.delete(schema.verification),
    db.delete(schema.user).where(eq(schema.user.id, userId)),
  ]);
}

/** Better Auth stores the role as free text; anything unknown is a plain user. */
export function roleOf(value: string | null | undefined): Role {
  const role = Role.safeParse(value);

  return role.success ? role.data : "user";
}
