import { describe, expect, it } from "vitest";

import {
  compareJsonValue,
  type ProbeTarget,
  probe,
  readJsonPath,
} from "@/modules/monitors/probe";

import { stubFetch } from "./support";

const target = (overrides: Partial<ProbeTarget> = {}): ProbeTarget => ({
  kind: "http",
  target: "https://example.com/health",
  timeoutMs: 10_000,
  retries: 0,
  assertions: [{ id: "status", type: "status", expected: 200 }],
  ...overrides,
});

describe("probe", () => {
  it("passes HTTP status, header, and JSON body assertions", async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        }),
    );

    const result = await probe(
      target({
        assertions: [
          { id: "a1", type: "status", expected: 200 },
          {
            id: "a2",
            type: "header",
            header: "content-type",
            operator: "contains",
            value: "application/json",
          },
          {
            id: "a3",
            type: "body",
            source: "json",
            path: "status",
            operator: "eq",
            value: "ok",
          },
        ],
      }),
    );

    expect(result).toMatchObject({ status: "up", error: null });
  });

  it("fails DNS assertions when the expected record is missing", async () => {
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({
            Status: 0,
            Answer: [{ type: 1, data: "198.51.100.5" }],
          }),
          { status: 200, headers: { "content-type": "application/dns-json" } },
        ),
    );

    const result = await probe(
      target({
        kind: "dns",
        target: "example.com",
        assertions: [
          {
            id: "dns-1",
            type: "record",
            recordType: "A",
            operator: "contains",
            value: "203.0.113.10",
          },
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "down",
      error: "A record assertion failed",
    });
  });

  it("accepts an expected non-success HTTP status", async () => {
    stubFetch(async () => new Response(null, { status: 404 }));

    const result = await probe(
      target({ assertions: [{ id: "404", type: "status", expected: 404 }] }),
    );

    expect(result).toMatchObject({
      status: "up",
      statusCode: 404,
      error: null,
    });
  });

  it("rejects assertion bodies larger than the limit", async () => {
    stubFetch(
      async () =>
        new Response("ignored", {
          status: 200,
          headers: { "content-length": String(1024 * 1024 + 1) },
        }),
    );

    const result = await probe(
      target({
        assertions: [
          {
            id: "body",
            type: "body",
            source: "text",
            operator: "contains",
            value: "ok",
          },
        ],
      }),
    );

    expect(result).toMatchObject({
      status: "down",
      error: "Response body exceeded 1048576 bytes",
    });
  });

  it("limits redirect chains", async () => {
    const fetchMock = stubFetch(
      async () =>
        new Response(null, { status: 302, headers: { location: "/next" } }),
    );

    const result = await probe(target());

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      status: "down",
      error: "Too many redirects (maximum 2)",
    });
  });
});

describe("JSON assertion helpers", () => {
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
