import { describe, expect, it, vi } from "vitest";

import { parseMonitorAssertions } from "@/lib/monitor/assertions";

describe("monitor assertion parsing", () => {
  it("parses valid assertion JSON and drops malformed assertions", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000000",
    );

    const assertions = parseMonitorAssertions(
      JSON.stringify([
        { type: "status", expected: 204 },
        {
          id: "header-1",
          type: "header",
          header: "content-type",
          operator: "contains",
          value: "json",
        },
        {
          id: "body-1",
          type: "body",
          source: "json",
          path: "data.ok",
          operator: "eq",
          value: "true",
        },
        {
          id: "dns-1",
          type: "record",
          recordType: "TXT",
          operator: "not_contains",
          value: "blocked",
        },
        {
          id: "bad-operator",
          type: "header",
          header: "x-test",
          operator: "starts_with",
          value: "nope",
        },
        {
          id: "bad-record",
          type: "record",
          recordType: "SRV",
          operator: "contains",
          value: "example.com",
        },
      ]),
    );

    expect(assertions).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000000",
        type: "status",
        expected: 204,
      },
      {
        id: "header-1",
        type: "header",
        header: "content-type",
        operator: "contains",
        value: "json",
      },
      {
        id: "body-1",
        type: "body",
        source: "json",
        path: "data.ok",
        operator: "eq",
        value: "true",
      },
      {
        id: "dns-1",
        type: "record",
        recordType: "TXT",
        operator: "not_contains",
        value: "blocked",
      },
    ]);
  });

  it("returns an empty list for invalid or non-array sources", () => {
    expect(parseMonitorAssertions("{")).toEqual([]);
    expect(parseMonitorAssertions("{}")).toEqual([]);
    expect(parseMonitorAssertions(null)).toEqual([]);
    expect(parseMonitorAssertions(undefined)).toEqual([]);
  });
});
