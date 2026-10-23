import type { Role } from "@/lib/schemas/auth";

/**
 * What each role may do. Server-function middleware enforces it; the UI uses
 * the same table only to hide actions a user can't perform.
 */
const capabilities = {
  admin: [
    "monitor.read",
    "monitor.create",
    "monitor.update",
    "monitor.pause",
    "monitor.resume",
    "monitor.delete",
    "monitor.import",
    "monitor.export",
    "statusPage.read",
    "statusPage.create",
    "statusPage.update",
    "statusPage.delete",
    "notification.read",
    "notification.create",
    "notification.update",
    "notification.delete",
    "notification.test",
    "settings.read",
    "settings.updateRetention",
    "account.read",
    "account.update",
    "account.deleteWorkspace",
  ],
  user: ["account.read", "account.update"],
} as const satisfies Record<Role, ReadonlyArray<string>>;

export type Capability = (typeof capabilities)["admin"][number];

const grants: Record<Role, ReadonlySet<Capability>> = {
  admin: new Set(capabilities.admin),
  user: new Set(capabilities.user),
};

export function can(role: Role, capability: Capability): boolean {
  return grants[role].has(capability);
}
