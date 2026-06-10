import { createPermix } from "permix";
import { describe, expect, it } from "vitest";

import {
  type AppPermissionsDefinition,
  getPermissionRules,
  resolvePermissionProfile,
} from "@/lib/permissions";

describe("permission rules", () => {
  it("maps admin users to the admin profile", () => {
    expect(resolvePermissionProfile("admin")).toBe("admin");
  });

  it("maps missing and non-admin roles to the user profile", () => {
    expect(resolvePermissionProfile("user")).toBe("user");
    expect(resolvePermissionProfile(null)).toBe("user");
  });

  it("allows administrators to perform workspace actions", () => {
    const permix = createPermix<AppPermissionsDefinition>();
    permix.setup(getPermissionRules("admin"));

    expect(permix.check("monitor.delete")).toBe(true);
    expect(permix.check("monitor.import")).toBe(true);
    expect(permix.check("settings.updateRetention")).toBe(true);
    expect(permix.check("account.deleteWorkspace")).toBe(true);
  });

  it("denies product administration to regular users", () => {
    const permix = createPermix<AppPermissionsDefinition>();
    permix.setup(getPermissionRules("user"));

    expect(permix.check("monitor.read")).toBe(false);
    expect(permix.check("monitor.delete")).toBe(false);
    expect(permix.check("settings.read")).toBe(false);
    expect(permix.check("account.deleteWorkspace")).toBe(false);
  });
});
