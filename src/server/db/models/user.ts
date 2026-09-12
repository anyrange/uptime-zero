import { count, eq } from "drizzle-orm";

import { schema, type DrizzleDatabase } from "@/server/db";

export class UserModel {
  constructor(private readonly db: DrizzleDatabase) {}

  async getSetupState(appName?: string) {
    const rows = await this.db.select({ count: count() }).from(schema.user);

    return {
      hasAdmin: (rows[0]?.count ?? 0) > 0,
      appName: appName ?? "Uptime Zero",
    };
  }

  async countUsers() {
    const rows = await this.db.select({ count: count() }).from(schema.user);

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
    const result = await this.db.query.user.findFirst({
      where: { id: userId },
      with: {
        accounts: {
          columns: {
            id: true,
            providerId: true,
            accountId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        sessions: {
          columns: {
            id: true,
            expiresAt: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!result) {
      return null;
    }

    const { accounts, sessions, ...user } = result;

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
    await this.db.batch([
      this.db.delete(schema.monitors),
      this.db.delete(schema.notificationDestinations),
      this.db.delete(schema.statusPages),
      this.db.delete(schema.appSettings),
      this.db.delete(schema.verification),
      this.db.delete(schema.user).where(eq(schema.user.id, userId)),
    ]);
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
