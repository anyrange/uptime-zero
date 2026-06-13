import { describe, expect, it } from "vitest";

import {
  parseNotificationConfig,
  parseNotificationHeaders,
  serializeNotificationConfig,
} from "@/server/services/notifications/config";

describe("notification config parsing/serialization", () => {
  it("parses webhook config and normalizes headers", () => {
    expect(
      parseNotificationConfig(
        "webhook",
        JSON.stringify({
          url: "https://example.com/hook",
          headers: [
            { key: " X-Key ", value: " secret " },
            { key: "", value: "ignored" },
          ],
        }),
      ),
    ).toEqual({
      url: "https://example.com/hook",
      headers: [{ key: "X-Key", value: "secret" }],
    });
  });

  it("parses discord destination config with fallback defaults", () => {
    expect(parseNotificationConfig("discord", "{}")).toEqual({
      webhookUrl: "",
    });
  });

  it("serializes telegram config and omits absent thread ids", () => {
    expect(
      serializeNotificationConfig("telegram", {
        botToken: "bot-token",
        chatId: "123456",
        messageThreadId: null,
      }),
    ).toBe(
      JSON.stringify({
        botToken: "bot-token",
        chatId: "123456",
      }),
    );
  });

  it("normalizes and filters headers independent of source type", () => {
    expect(
      parseNotificationHeaders(
        "not-an-array" as unknown as Record<string, unknown>,
      ),
    ).toEqual([]);

    expect(
      parseNotificationHeaders([
        { key: "  X-Auth ", value: "abc" },
        { key: "", value: "ignored" },
        { key: null as unknown as string, value: 42 },
      ]),
    ).toEqual([{ key: "X-Auth", value: "abc" }]);
  });

  it("throws when config JSON is malformed", () => {
    expect(() => parseNotificationConfig("discord", "{not-json")).toThrow();
  });

  it("serializes webhook config with normalized headers", () => {
    expect(
      serializeNotificationConfig("webhook", {
        url: "https://example.com/hook",
        headers: [
          { key: "X-Api-Key", value: "alpha" },
          { key: " ", value: "ignored" },
        ],
      }),
    ).toBe(
      JSON.stringify({
        url: "https://example.com/hook",
        headers: [{ key: "X-Api-Key", value: "alpha" }],
      }),
    );
  });
});
