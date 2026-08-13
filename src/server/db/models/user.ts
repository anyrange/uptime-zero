import { eq, sql } from "drizzle-orm";

import { schema, type DrizzleDatabase } from "@/server/db";

export class UserModel {
  constructor(private readonly db: DrizzleDatabase) {}

  async getSetupState(appName?: string) {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.user);

    return {
      hasAdmin: (rows[0]?.count ?? 0) > 0,
      appName: appName ?? "Uptime Zero",
    };
  }

  async countUsers() {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.user);
    return rows[0]?.count ?? 0;
  }

  promoteUserToAdmin(userId: string) {
    return this.db
      .update(schema.user)
      .set({ role: "admin" })
      .where(eq(schema.user.id, userId));
  }

  findUserByEmail(email: string) {
    return this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .get();
  }

  async getUserRole(userId: string) {
    const user = await this.db
      .select({ role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .get();
    return readUserRole(user?.role);
  }

  async getAccount(userId: string) {
    const user = await this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .get();

    if (!user) {
      return null;
    }

    const accounts = await this.db
      .select({
        id: schema.account.id,
        providerId: schema.account.providerId,
        accountId: schema.account.accountId,
        createdAt: schema.account.createdAt,
        updatedAt: schema.account.updatedAt,
      })
      .from(schema.account)
      .where(eq(schema.account.userId, userId));

    const sessions = await this.db
      .select({
        id: schema.session.id,
        expiresAt: schema.session.expiresAt,
        ipAddress: schema.session.ipAddress,
        userAgent: schema.session.userAgent,
        createdAt: schema.session.createdAt,
        updatedAt: schema.session.updatedAt,
      })
      .from(schema.session)
      .where(eq(schema.session.userId, userId));

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        role: readUserRole(user.role) ?? "user",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accounts,
      sessions,
    };
  }

  updateUserName(userId: string, name: string) {
    return this.db
      .update(schema.user)
      .set({ name, updatedAt: new Date() })
      .where(eq(schema.user.id, userId));
  }

  async updateAccountName(userId: string, name: string) {
    await this.updateUserName(userId, name);
    return this.getAccount(userId);
  }

  async deleteUserAndWorkspaceData(userId: string) {
    await this.db.delete(schema.monitorNotificationDestinations);
    await this.db.delete(schema.notificationDestinations);
    await this.db.delete(schema.statusPageMonitors);
    await this.db.delete(schema.statusPages);
    await this.db.delete(schema.incidents);
    await this.db.delete(schema.heartbeats);
    await this.db.delete(schema.monitors);
    await this.db.delete(schema.appSettings);
    await this.db.delete(schema.verification);
    await this.deleteSessionsForUser(userId);
    await this.deleteAccountsForUser(userId);
    await this.deleteUser(userId);
  }

  deleteSessionsForUser(userId: string) {
    return this.db
      .delete(schema.session)
      .where(eq(schema.session.userId, userId));
  }

  deleteAccountsForUser(userId: string) {
    return this.db
      .delete(schema.account)
      .where(eq(schema.account.userId, userId));
  }

  deleteUser(userId: string) {
    return this.db.delete(schema.user).where(eq(schema.user.id, userId));
  }

  deleteAllVerifications() {
    return this.db.delete(schema.verification);
  }
}

function readUserRole(
  value: string | null | undefined,
): "admin" | "user" | null {
  return value === "admin" || value === "user" ? value : null;
}
