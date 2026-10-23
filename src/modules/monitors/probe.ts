import "@tanstack/react-start/server-only";
import { z } from "zod";

import type {
  DnsRecordType,
  JsonOperator,
  Monitor,
  MonitorAssertion,
  MonitorStatus,
  TextAssertionOperator,
} from "@/lib/schemas/monitors";

import {
  MAX_MONITOR_RETRIES,
  MAX_MONITOR_TIMEOUT_MS,
} from "@/lib/schemas/monitor-config";

/**
 * Probes a monitor's target once (plus its retry budget) and reports what it
 * saw. Every failure — network, timeout, assertion — becomes a `down`
 * result, so probing itself never throws. Requests go through the global
 * `fetch`, which tests stub.
 */

export type ProbeTarget = Pick<
  Monitor,
  "kind" | "target" | "timeoutMs" | "retries" | "assertions"
>;

/** The outcome of one probe, before it is persisted as a heartbeat. */
export type CheckResult = {
  readonly status: MonitorStatus;
  readonly statusCode: number | null;
  readonly durationMs: number;
  readonly error: string | null;
};

type Outcome = Omit<CheckResult, "durationMs">;

const USER_AGENT = "uptime-zero/0.1.0";

const MAX_HTTP_REDIRECTS = 2;

const MAX_RESPONSE_BODY_BYTES = 1024 * 1024;

const DEFAULT_DNS_RECORD_TYPES: ReadonlyArray<DnsRecordType> = ["A"];

/** Why one attempt failed; reported as the result's `error`. */
class ProbeFailure extends Error {
  override name = "ProbeFailure";
}

export async function probe(target: ProbeTarget): Promise<CheckResult> {
  const bounded = {
    ...target,
    timeoutMs: Math.min(target.timeoutMs, MAX_MONITOR_TIMEOUT_MS),
  };

  const attempt = () =>
    measure(bounded.timeoutMs, (signal) =>
      target.kind === "dns"
        ? probeDns(bounded, signal)
        : probeHttp(bounded, signal),
    );

  let result = await attempt();

  for (
    let retry = 0;
    retry < Math.min(target.retries, MAX_MONITOR_RETRIES) &&
    result.status === "down";
    retry += 1
  ) {
    result = await attempt();
  }

  return result;
}

/**
 * Times one attempt and turns any failure into a `down` result. The whole
 * attempt (redirects, body, every DNS query) shares one timeout signal.
 */
async function measure(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<Outcome>,
): Promise<CheckResult> {
  const startedAt = Date.now();
  const signal = AbortSignal.timeout(timeoutMs);

  let outcome: Outcome;

  try {
    outcome = await run(signal);
  } catch (error) {
    outcome = down(
      null,
      signal.aborted
        ? `Timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : "Request failed",
    );
  }

  return { ...outcome, durationMs: Date.now() - startedAt };
}

async function probeHttp(
  target: ProbeTarget,
  signal: AbortSignal,
): Promise<Outcome> {
  const response = await fetchFollowingRedirects(target.target, signal);
  const needsBody = target.assertions.some((a) => a.type === "body");

  let body = "";

  if (needsBody) body = await readBoundedText(response);
  else await response.body?.cancel();

  const failure = httpAssertionFailure(target.assertions, response, body);

  if (failure) return down(response.status, failure);

  const assertsStatus = target.assertions.some((a) => a.type === "status");

  if (!response.ok && !assertsStatus) {
    return down(response.status, `HTTP ${response.status}`);
  }

  return up(response.status);
}

async function probeDns(
  target: ProbeTarget,
  signal: AbortSignal,
): Promise<Outcome> {
  const recordAssertions = target.assertions.filter(
    (assertion): assertion is Extract<MonitorAssertion, { type: "record" }> =>
      assertion.type === "record",
  );

  const requested = [
    ...new Set(recordAssertions.map((assertion) => assertion.recordType)),
  ];

  const answers: Array<{ data: string; type: DnsRecordType }> = [];

  for (const recordType of requested.length > 0
    ? requested
    : DEFAULT_DNS_RECORD_TYPES) {
    answers.push(...(await queryDns(target.target, recordType, signal)));
  }

  for (const assertion of recordAssertions) {
    const matched = answers.some(
      (answer) =>
        answer.type === assertion.recordType &&
        compareText(answer.data, assertion.operator, assertion.value),
    );

    if (!matched) {
      return down(null, `${assertion.recordType} record assertion failed`);
    }
  }

  return up(null);
}

function up(statusCode: number | null): Outcome {
  return { status: "up", statusCode, error: null };
}

function down(statusCode: number | null, error: string): Outcome {
  return { status: "down", statusCode, error };
}

/** Follows at most two redirects by hand so each hop stays observable. */
async function fetchFollowingRedirects(target: string, signal: AbortSignal) {
  let url = target;

  for (let redirects = 0; ; redirects += 1) {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": USER_AGENT },
      signal,
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");

    await response.body?.cancel();

    if (!location) {
      throw new ProbeFailure("Redirect response was missing a location header");
    }

    if (redirects >= MAX_HTTP_REDIRECTS) {
      throw new ProbeFailure(
        `Too many redirects (maximum ${MAX_HTTP_REDIRECTS})`,
      );
    }

    url = new URL(location, url).toString();
  }
}

const tooLarge = `Response body exceeded ${MAX_RESPONSE_BODY_BYTES} bytes`;

/** Reads the body up to 1 MiB; a bigger body fails the attempt. */
async function readBoundedText(response: Response) {
  const declared = Number(response.headers.get("content-length"));

  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BODY_BYTES) {
    await response.body?.cancel();

    throw new ProbeFailure(tooLarge);
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      bytesRead += value.byteLength;

      if (bytesRead > MAX_RESPONSE_BODY_BYTES) {
        await reader.cancel();

        throw new ProbeFailure(tooLarge);
      }

      chunks.push(decoder.decode(value, { stream: true }));
    }

    chunks.push(decoder.decode());

    return chunks.join("");
  } finally {
    reader.releaseLock();
  }
}

const Json = z.json();

type Json = z.infer<typeof Json>;

/** Parses a response body; undefined when it isn't JSON. */
function parseJson(text: string) {
  try {
    return Json.parse(JSON.parse(text));
  } catch {
    return undefined;
  }
}

const DnsJsonResponse = z.object({
  Status: z.number().optional(),
  Answer: z
    .array(
      z.object({
        type: z.number().optional(),
        data: z.string().optional(),
      }),
    )
    .optional(),
  Comment: z.string().optional(),
});

/** Resolves one record type through Cloudflare's DNS-over-HTTPS JSON API. */
async function queryDns(
  hostname: string,
  recordType: DnsRecordType,
  signal: AbortSignal,
) {
  const url = new URL("https://cloudflare-dns.com/dns-query");
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", recordType);

  const response = await fetch(url, {
    method: "GET",
    redirect: "error",
    headers: { accept: "application/dns-json", "user-agent": USER_AGENT },
    signal,
  });

  if (!response.ok) {
    throw new ProbeFailure(`DNS lookup failed with HTTP ${response.status}`);
  }

  const parsed = DnsJsonResponse.safeParse(
    await response.json().catch(() => undefined),
  );

  if (!parsed.success) {
    throw new ProbeFailure("DNS lookup returned invalid JSON");
  }

  const payload = parsed.data;

  if ((payload.Status ?? 0) !== 0) {
    throw new ProbeFailure(
      payload.Comment || `DNS lookup failed (${payload.Status})`,
    );
  }

  return (payload.Answer ?? []).flatMap((answer) =>
    answer.data
      ? [
          {
            data: answer.data.trim().replace(/^"|"$/g, ""),
            type: recordTypeFromCode(answer.type) ?? recordType,
          },
        ]
      : [],
  );
}

/** The first assertion the response breaks, or null when all hold. */
function httpAssertionFailure(
  assertions: ReadonlyArray<MonitorAssertion>,
  response: Response,
  body: string,
) {
  for (const assertion of assertions) {
    switch (assertion.type) {
      case "status":
        if (response.status !== assertion.expected) {
          return `Expected HTTP ${assertion.expected}, got ${response.status}`;
        }

        break;
      case "header":
        if (
          !compareText(
            response.headers.get(assertion.header) ?? "",
            assertion.operator,
            assertion.value,
          )
        ) {
          return `Header assertion failed for ${assertion.header}`;
        }

        break;
      case "body":
        if (assertion.source === "text") {
          if (!compareText(body, assertion.operator, assertion.value)) {
            return "Body assertion failed";
          }

          break;
        }

        {
          // An empty body reads as `null`.
          const payload = body ? parseJson(body) : null;

          if (payload === undefined) return "Response was not valid JSON";

          if (
            !compareJsonValue(
              readJsonPath(payload, assertion.path),
              assertion.operator,
              assertion.value,
            )
          ) {
            return `JSON assertion failed at ${assertion.path || "$"}`;
          }
        }

        break;
      case "record":
        break;
    }
  }

  return null;
}

function compareText(
  actual: string,
  operator: TextAssertionOperator,
  expected: string,
) {
  switch (operator) {
    case "equals":
      return actual === expected;
    case "not_contains":
      return !actual.includes(expected);
    case "contains":
      return actual.includes(expected);
  }
}

const Text = z.string();

/** Compares a JSON value against an expectation typed as text in the form. */
export function compareJsonValue(
  actual: Json | undefined,
  operator: JsonOperator,
  expectedRaw: string,
): boolean {
  const expected = parseScalar(expectedRaw);

  switch (operator) {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "includes":
      if (Array.isArray(actual)) return actual.includes(expected);

      return Text.safeParse(actual).data?.includes(expectedRaw) ?? false;
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
  }
}

/** Reads `a.b[0].c`-style paths; an empty path selects the whole value. */
export function readJsonPath(input: Json, path: string): Json | undefined {
  if (!path) return input;

  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .reduce<Json | undefined>((current, segment) => {
      if (Array.isArray(current)) {
        const index = Number.parseInt(segment, 10);

        return Number.isFinite(index) ? current[index] : undefined;
      }

      // Arrays are handled above, so only JSON objects pass.
      return current instanceof Object ? current[segment] : undefined;
    }, input);
}

function parseScalar(value: string): string | number | boolean | null {
  if (value === "true") return true;

  if (value === "false") return false;

  if (value === "null") return null;

  const number = Number(value);

  return value.trim() !== "" && !Number.isNaN(number) ? number : value;
}

function recordTypeFromCode(code: number | undefined): DnsRecordType | null {
  switch (code) {
    case 1:
      return "A";
    case 2:
      return "NS";
    case 5:
      return "CNAME";
    case 15:
      return "MX";
    case 16:
      return "TXT";
    case 28:
      return "AAAA";
    default:
      return null;
  }
}
