import type * as schema from "@schema";

import { z } from "zod";

import { m } from "@/paraglide/messages.js";

/**
 * Monitor values every layer shares. Row types come from the Drizzle schema;
 * zod covers the literal sets the UI offers and the assertions stored as
 * JSON in `monitors.assertionsJson`.
 */

export const MonitorKind = z.enum(["http", "dns", "push"]);

export type MonitorKind = z.infer<typeof MonitorKind>;

export const MonitorStatus = z.enum(["up", "down", "unknown"]);

export type MonitorStatus = z.infer<typeof MonitorStatus>;

export const HeartbeatMode = z.enum(["interval", "cron"]);

export type HeartbeatMode = z.infer<typeof HeartbeatMode>;

export const TextAssertionOperator = z.enum([
  "contains",
  "equals",
  "not_contains",
]);

export type TextAssertionOperator = z.infer<typeof TextAssertionOperator>;

export const JsonOperator = z.enum([
  "eq",
  "ne",
  "includes",
  "gt",
  "gte",
  "lt",
  "lte",
]);

export type JsonOperator = z.infer<typeof JsonOperator>;

export const DnsRecordType = z.enum(["A", "AAAA", "CNAME", "MX", "NS", "TXT"]);

export type DnsRecordType = z.infer<typeof DnsRecordType>;

const RequiredText = z
  .string()
  .trim()
  .min(1, { error: () => m.validation_assertion_field_required() });

/** One rule a check result must satisfy; the union is discriminated by `type`. */
export const MonitorAssertion = z.discriminatedUnion("type", [
  z.object({
    id: RequiredText,
    type: z.literal("status"),
    expected: z.int(),
  }),
  z.object({
    id: RequiredText,
    type: z.literal("header"),
    header: RequiredText,
    operator: TextAssertionOperator,
    value: z.string(),
  }),
  z.discriminatedUnion("source", [
    z.object({
      id: RequiredText,
      type: z.literal("body"),
      source: z.literal("text"),
      operator: TextAssertionOperator,
      value: z.string(),
    }),
    z.object({
      id: RequiredText,
      type: z.literal("body"),
      source: z.literal("json"),
      path: RequiredText,
      operator: JsonOperator,
      value: z.string(),
    }),
  ]),
  z.object({
    id: RequiredText,
    type: z.literal("record"),
    recordType: DnsRecordType,
    operator: TextAssertionOperator,
    value: z.string(),
  }),
]);

export type MonitorAssertion = z.infer<typeof MonitorAssertion>;

/**
 * A monitor as services return it: the stored row with its assertions
 * parsed. `pushToken` is the secret path segment for push heartbeats;
 * `revision` is bumped on every write so a check result only lands on the
 * revision it ran against; `retryAt` is the epoch ms before which the
 * scheduler must not retry a failed check.
 */
export type Monitor = Omit<
  typeof schema.monitors.$inferSelect,
  "assertionsJson"
> & { assertions: MonitorAssertion[] };

export type Heartbeat = typeof schema.heartbeats.$inferSelect;
