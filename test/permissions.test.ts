import { describe, expect, it } from "vitest";

import { can } from "@/lib/permissions";

describe("permissions", () => {
  it("allows administrators to perform workspace actions", () => {
    expect(can("admin", "monitor.delete")).toBe(true);
    expect(can("admin", "monitor.import")).toBe(true);
    expect(can("admin", "settings.updateRetention")).toBe(true);
    expect(can("admin", "account.deleteWorkspace")).toBe(true);
  });

  it("limits regular users to their own account", () => {
    expect(can("user", "account.read")).toBe(true);
    expect(can("user", "account.update")).toBe(true);
    expect(can("user", "monitor.read")).toBe(false);
    expect(can("user", "monitor.delete")).toBe(false);
    expect(can("user", "settings.read")).toBe(false);
    expect(can("user", "account.deleteWorkspace")).toBe(false);
  });
});
