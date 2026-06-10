import { createPermix, type Rules } from "permix";

export type UserRole = "admin" | "user";
export type PermissionProfile = "admin" | "user";

export type AppPermissionsDefinition = {
  monitor: [
    "read",
    "create",
    "update",
    "pause",
    "resume",
    "delete",
    "import",
    "export",
  ];
  statusPage: ["read", "create", "update", "delete"];
  notification: ["read", "create", "update", "delete", "test"];
  settings: ["read", "updateRetention"];
  account: ["read", "update", "deleteWorkspace"];
};

export type AppPermissionPath = (typeof permix)["$inferPath"];
export type AppPermissionRules = Rules<AppPermissionsDefinition>;

export const permix = createPermix<AppPermissionsDefinition>();

const adminPermissions = permix.template({
  monitor: {
    read: true,
    create: true,
    update: true,
    pause: true,
    resume: true,
    delete: true,
    import: true,
    export: true,
  },
  statusPage: {
    read: true,
    create: true,
    update: true,
    delete: true,
  },
  notification: {
    read: true,
    create: true,
    update: true,
    delete: true,
    test: true,
  },
  settings: {
    read: true,
    updateRetention: true,
  },
  account: {
    read: true,
    update: true,
    deleteWorkspace: true,
  },
});

const userPermissions = permix.template({
  monitor: {
    read: false,
    create: false,
    update: false,
    pause: false,
    resume: false,
    delete: false,
    import: false,
    export: false,
  },
  statusPage: {
    read: false,
    create: false,
    update: false,
    delete: false,
  },
  notification: {
    read: false,
    create: false,
    update: false,
    delete: false,
    test: false,
  },
  settings: {
    read: false,
    updateRetention: false,
  },
  account: {
    read: true,
    update: true,
    deleteWorkspace: false,
  },
});

export function resolvePermissionProfile(
  role: UserRole | null | undefined,
): PermissionProfile {
  if (role === "admin") return "admin";
  return "user";
}

export function getPermissionRules(
  role: UserRole | null | undefined,
): AppPermissionRules {
  const profile = resolvePermissionProfile(role);

  if (profile === "admin") return adminPermissions();
  return userPermissions();
}
