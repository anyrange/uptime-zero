import { z } from "zod";

import type { DnsRecordType, MonitorAssertion } from "@/types";

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

export function normalizeMonitorAssertions(
  source: MonitorAssertion[] | string | null | undefined,
) {
  const parsed =
    typeof source === "string"
      ? safeParseAssertionsJson(source)
      : Array.isArray(source)
        ? source
        : [];
  return parsed.map(sanitizeAssertion).filter(Boolean) as MonitorAssertion[];
}

function safeParseAssertionsJson(source: string) {
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sanitizeAssertion(value: unknown): MonitorAssertion | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id =
    typeof candidate.id === "string" && candidate.id
      ? candidate.id
      : crypto.randomUUID();

  if (candidate.type === "status" && typeof candidate.expected === "number") {
    return { id, type: "status", expected: candidate.expected };
  }

  if (
    candidate.type === "header" &&
    typeof candidate.header === "string" &&
    typeof candidate.value === "string" &&
    typeof candidate.operator === "string" &&
    includes(textAssertionOperators, candidate.operator)
  ) {
    return {
      id,
      type: "header",
      header: candidate.header,
      operator: candidate.operator,
      value: candidate.value,
    };
  }

  if (
    candidate.type === "body" &&
    candidate.source === "text" &&
    typeof candidate.value === "string" &&
    typeof candidate.operator === "string" &&
    includes(textAssertionOperators, candidate.operator)
  ) {
    return {
      id,
      type: "body",
      source: "text",
      operator: candidate.operator,
      value: candidate.value,
    };
  }

  if (
    candidate.type === "body" &&
    candidate.source === "json" &&
    typeof candidate.path === "string" &&
    typeof candidate.value === "string" &&
    typeof candidate.operator === "string" &&
    includes(jsonOperators, candidate.operator)
  ) {
    return {
      id,
      type: "body",
      source: "json",
      path: candidate.path,
      operator: candidate.operator,
      value: candidate.value,
    };
  }

  if (
    candidate.type === "record" &&
    typeof candidate.recordType === "string" &&
    typeof candidate.value === "string" &&
    typeof candidate.operator === "string" &&
    includes(dnsRecordTypes, candidate.recordType) &&
    includes(textAssertionOperators, candidate.operator)
  ) {
    return {
      id,
      type: "record",
      recordType: candidate.recordType as DnsRecordType,
      operator: candidate.operator,
      value: candidate.value,
    };
  }

  return null;
}

function includes<const T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
}
