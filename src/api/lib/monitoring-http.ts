import type {
  DnsRecordType,
  JsonOperator,
  MonitorAssertion,
  MonitorCheckResult,
  MonitorRecord,
  TextAssertionOperator,
} from "@/types";

type DnsJsonAnswer = {
  name?: string;
  type?: number;
  TTL?: number;
  data?: string;
};

type DnsJsonResponse = {
  Status?: number;
  TC?: boolean;
  RD?: boolean;
  RA?: boolean;
  AD?: boolean;
  CD?: boolean;
  Question?: Array<{ name?: string; type?: number }>;
  Answer?: DnsJsonAnswer[];
  Comment?: string;
};

const DNS_RECORD_TYPES: Record<DnsRecordType, number> = {
  A: 1,
  NS: 2,
  CNAME: 5,
  MX: 15,
  TXT: 16,
  AAAA: 28,
};

export function compareJsonValue(
  actual: unknown,
  operator: JsonOperator,
  expectedRaw: string,
): boolean {
  const expectedParsed = tryParseScalar(expectedRaw);
  switch (operator) {
    case "eq":
      return actual === expectedParsed;
    case "ne":
      return actual !== expectedParsed;
    case "includes":
      if (typeof actual === "string") {
        return actual.includes(expectedRaw);
      }
      if (Array.isArray(actual)) {
        return actual.includes(expectedParsed);
      }
      return false;
    case "gt":
      return Number(actual) > Number(expectedParsed);
    case "gte":
      return Number(actual) >= Number(expectedParsed);
    case "lt":
      return Number(actual) < Number(expectedParsed);
    case "lte":
      return Number(actual) <= Number(expectedParsed);
  }
}

export function readJsonPath(input: unknown, path: string): unknown {
  if (!path) {
    return input;
  }
  const normalized = path.replace(/\[(\d+)\]/g, ".$1");
  return normalized
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((current, segment) => {
      if (current == null) {
        return undefined;
      }
      if (Array.isArray(current)) {
        const index = Number.parseInt(segment, 10);
        return Number.isFinite(index) ? current[index] : undefined;
      }
      if (typeof current === "object") {
        return (current as Record<string, unknown>)[segment];
      }
      return undefined;
    }, input);
}

export async function runHttpCheck(
  monitor: MonitorRecord,
  fetchImpl: typeof fetch,
): Promise<MonitorCheckResult> {
  if (monitor.kind === "dns") {
    return runDnsCheck(monitor, fetchImpl);
  }

  const startedAt = Date.now();
  try {
    const response = await fetchImpl(monitor.target, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(monitor.timeoutMs),
      headers: {
        "user-agent": "uptime-zero/0.1.0",
      },
    });
    const durationMs = Date.now() - startedAt;
    const bodyText = await response.text();
    const assertionFailure = runHttpAssertions(
      monitor.assertions,
      response,
      bodyText,
    );
    if (assertionFailure) {
      return {
        status: "down",
        statusCode: response.status,
        durationMs,
        error: assertionFailure,
        responseText: bodyText,
      };
    }
    if (!response.ok) {
      return {
        status: "down",
        statusCode: response.status,
        durationMs,
        error: `HTTP ${response.status}`,
        responseText: bodyText,
      };
    }

    return {
      status: "up",
      statusCode: response.status,
      durationMs,
      error: null,
      responseText: bodyText,
    };
  } catch (error) {
    return {
      status: "down",
      statusCode: null,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function runHttpAssertions(
  assertions: MonitorAssertion[],
  response: Response,
  bodyText: string,
) {
  for (const assertion of assertions) {
    if (assertion.type === "status") {
      if (response.status !== assertion.expected) {
        return `Expected HTTP ${assertion.expected}, got ${response.status}`;
      }
      continue;
    }

    if (assertion.type === "header") {
      const actualValue = response.headers.get(assertion.header) ?? "";
      if (!compareTextValue(actualValue, assertion.operator, assertion.value)) {
        return `Header assertion failed for ${assertion.header}`;
      }
      continue;
    }

    if (assertion.type === "body" && assertion.source === "text") {
      if (!compareTextValue(bodyText, assertion.operator, assertion.value)) {
        return "Body assertion failed";
      }
      continue;
    }

    if (assertion.type === "body" && assertion.source === "json") {
      let payload: unknown;
      try {
        payload = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        return "Response was not valid JSON";
      }
      const actual = readJsonPath(payload, assertion.path);
      const matched = compareJsonValue(
        actual,
        assertion.operator,
        assertion.value,
      );
      if (!matched) {
        return `JSON assertion failed at ${assertion.path || "$"}`;
      }
    }
  }

  return null;
}

async function runDnsCheck(
  monitor: MonitorRecord,
  fetchImpl: typeof fetch,
): Promise<MonitorCheckResult> {
  const startedAt = Date.now();
  const recordAssertions = monitor.assertions.filter(
    (assertion): assertion is Extract<MonitorAssertion, { type: "record" }> =>
      assertion.type === "record",
  );
  const requestedTypes = Array.from(
    new Set(recordAssertions.map((assertion) => assertion.recordType)),
  );

  try {
    const results = await Promise.all(
      (requestedTypes.length ? requestedTypes : (["A"] as DnsRecordType[])).map(
        (recordType) =>
          queryDnsRecord(
            fetchImpl,
            monitor.target,
            recordType,
            monitor.timeoutMs,
          ),
      ),
    );
    const durationMs = Date.now() - startedAt;
    const flattenedAnswers = results.flatMap((result) => result.answers);

    for (const assertion of recordAssertions) {
      const matchingAnswers = flattenedAnswers
        .filter((answer) => answer.type === assertion.recordType)
        .map((answer) => answer.data);
      const matched = matchingAnswers.some((answer) =>
        compareTextValue(answer, assertion.operator, assertion.value),
      );
      if (!matched) {
        return {
          status: "down",
          statusCode: null,
          durationMs,
          error: `${assertion.recordType} record assertion failed`,
          details: matchingAnswers.length
            ? matchingAnswers.join(", ")
            : "No records returned",
        };
      }
    }

    return {
      status: "up",
      statusCode: null,
      durationMs,
      error: null,
      details: flattenedAnswers.map((answer) => answer.data).join(", ") || null,
    };
  } catch (error) {
    return {
      status: "down",
      statusCode: null,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "DNS query failed",
    };
  }
}

async function queryDnsRecord(
  fetchImpl: typeof fetch,
  hostname: string,
  recordType: DnsRecordType,
  timeoutMs: number,
) {
  const url = new URL("https://cloudflare-dns.com/dns-query");
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", recordType);

  const response = await fetchImpl(url, {
    method: "GET",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      accept: "application/dns-json",
      "user-agent": "uptime-zero/0.1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`DNS lookup failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as DnsJsonResponse;
  if ((payload.Status ?? 0) !== 0) {
    throw new Error(payload.Comment || `DNS lookup failed (${payload.Status})`);
  }

  return {
    recordType,
    answers: (payload.Answer ?? [])
      .filter((answer) => answer.data)
      .map((answer) => ({
        data: normalizeDnsAnswerData(answer.data ?? ""),
        type: recordTypeFromCode(answer.type) ?? recordType,
      })),
  };
}

function compareTextValue(
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

function normalizeDnsAnswerData(value: string) {
  return value.trim().replace(/^"|"$/g, "");
}

function recordTypeFromCode(code: number | undefined) {
  return (Object.entries(DNS_RECORD_TYPES).find(
    ([, value]) => value === code,
  )?.[0] ?? null) as DnsRecordType | null;
}

function tryParseScalar(value: string): string | number | boolean | null {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (value === "null") {
    return null;
  }
  const numberValue = Number(value);
  if (!Number.isNaN(numberValue) && value.trim() !== "") {
    return numberValue;
  }
  return value;
}
