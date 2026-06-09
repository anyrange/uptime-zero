import { describe, expect, it } from "vitest";

import { compareJsonValue, readJsonPath } from "@/server/lib/monitoring-http";

describe("HTTP monitoring assertion helpers", () => {
  it("reads dotted and indexed JSON paths", () => {
    const payload = {
      status: "ok",
      checks: [{ name: "api", duration: 120 }],
      nested: { items: ["first", "second"] },
    };

    expect(readJsonPath(payload, "")).toBe(payload);
    expect(readJsonPath(payload, "status")).toBe("ok");
    expect(readJsonPath(payload, "checks[0].duration")).toBe(120);
    expect(readJsonPath(payload, "nested.items.1")).toBe("second");
    expect(readJsonPath(payload, "checks.name")).toBeUndefined();
    expect(readJsonPath(payload, "missing.value")).toBeUndefined();
  });

  it("compares JSON values with parsed scalar expectations", () => {
    expect(compareJsonValue(true, "eq", "true")).toBe(true);
    expect(compareJsonValue(null, "eq", "null")).toBe(true);
    expect(compareJsonValue(3, "gt", "2")).toBe(true);
    expect(compareJsonValue(3, "gte", "3")).toBe(true);
    expect(compareJsonValue(3, "lt", "4")).toBe(true);
    expect(compareJsonValue(3, "lte", "3")).toBe(true);
    expect(compareJsonValue("healthy", "includes", "health")).toBe(true);
    expect(compareJsonValue(["api", "web"], "includes", "web")).toBe(true);
    expect(compareJsonValue("ok", "ne", "down")).toBe(true);
  });

  it("rejects non-matching JSON comparisons", () => {
    expect(compareJsonValue("1", "eq", "1")).toBe(false);
    expect(compareJsonValue(["1"], "includes", "1")).toBe(false);
    expect(compareJsonValue({ value: "ok" }, "includes", "ok")).toBe(false);
    expect(compareJsonValue("2", "gt", "10")).toBe(false);
  });
});
