import { z } from "zod";

import type { MonitorAssertion } from "@/types";

export const textAssertionOperators = [
  "contains",
  "equals",
  "not_contains",
] as const;
export const jsonOperators = [
  "eq",
  "ne",
  "includes",
  "gt",
  "gte",
  "lt",
  "lte",
] as const;
export const dnsRecordTypes = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "NS",
  "TXT",
] as const;

export const textOperatorSchema = z.enum(textAssertionOperators);
export const jsonOperatorSchema = z.enum(jsonOperators);
export const dnsRecordTypeSchema = z.enum(dnsRecordTypes);

export const monitorAssertionSchema = z.union([
  z.object({
    id: z.string().trim().min(1),
    type: z.literal("status"),
    expected: z.coerce.number().int(),
  }),
  z.object({
    id: z.string().trim().min(1),
    type: z.literal("header"),
    header: z.string().trim().min(1),
    operator: textOperatorSchema,
    value: z.string(),
  }),
  z.object({
    id: z.string().trim().min(1),
    type: z.literal("body"),
    source: z.literal("text"),
    operator: textOperatorSchema,
    value: z.string(),
  }),
  z.object({
    id: z.string().trim().min(1),
    type: z.literal("body"),
    source: z.literal("json"),
    path: z.string().trim().min(1),
    operator: jsonOperatorSchema,
    value: z.string(),
  }),
  z.object({
    id: z.string().trim().min(1),
    type: z.literal("record"),
    recordType: dnsRecordTypeSchema,
    operator: textOperatorSchema,
    value: z.string(),
  }),
]);

export function parseMonitorAssertions(
  source: MonitorAssertion[] | string | null | undefined,
) {
  const parsed =
    typeof source === "string"
      ? safeParseAssertionsJson(source)
      : Array.isArray(source)
        ? source
        : [];
  return parsed.flatMap((value) => {
    const result = monitorAssertionSchema.safeParse(withAssertionId(value));
    return result.success ? [result.data] : [];
  });
}

function safeParseAssertionsJson(source: string) {
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function withAssertionId(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id === "string" && candidate.id.trim()) {
    return candidate;
  }

  return { ...candidate, id: crypto.randomUUID() };
}
