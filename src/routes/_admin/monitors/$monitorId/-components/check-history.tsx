import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  XAxis,
  YAxis,
} from "recharts";

import type { HeartbeatRecord, IncidentRecord, MonitorKind } from "@/types";

import { StatusBar } from "@/components/blocks/status-bar";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { buildHourlyStatusBarData } from "@/lib/status-blocks";
import { m } from "@/paraglide/messages.js";

type LatencyPoint = {
  timestamp: number;
  timeLabel: string;
  latencyMs: number;
};

type OutcomePoint = {
  status: string;
  count: number;
  fill: string;
};

type MonitorChartData = {
  latencyPoints: LatencyPoint[];
  percentilePoints: Array<{
    timestamp: number;
    timeLabel: string;
    p50: number;
    p95: number;
    avg: number;
  }>;
  outcomePoints: OutcomePoint[];
  incidentMarkers: Array<{
    id: string;
    start: number;
    end: number;
  }>;
  statusCodeSummary: string | null;
  bucketLabel: string;
};

const percentileChartConfig = {
  p50: {
    label: m.monitor_latency_p50(),
    color: "var(--chart-1)",
  },
  p95: {
    label: m.monitor_latency_p95(),
    color: "var(--chart-5)",
  },
  avg: {
    label: m.common_average(),
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const outcomeChartConfig = {
  count: {
    label: m.monitor_checks(),
  },
  up: {
    label: m.common_up(),
    color: "var(--success)",
  },
  down: {
    label: m.common_down(),
    color: "var(--destructive)",
  },
  unknown: {
    label: m.common_unknown(),
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig;

export function CheckHistory({
  heartbeats,
  incidents,
  monitorKind,
  requestCount,
}: {
  heartbeats: HeartbeatRecord[];
  incidents: IncidentRecord[];
  monitorKind: MonitorKind;
  requestCount: number;
}) {
  const charts = useMemo(
    () => deriveMonitorCharts({ heartbeats, incidents, monitorKind }),
    [heartbeats, incidents, monitorKind],
  );
  const statusBarData = useMemo(
    () => buildHourlyStatusBarData(heartbeats, incidents, 48),
    [heartbeats, incidents],
  );

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="monitor-uptime-heading"
        className="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-medium" id="monitor-uptime-heading">
              {m.common_uptime()}
            </h2>
            <p className="text-sm text-muted-foreground">
              {m.monitor_uptime_description()}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{m.monitor_latest_48_hours()}</p>
            <p>{m.monitor_recorded_check_count({ count: requestCount })}</p>
          </div>
        </div>
        <StatusBar data={statusBarData} />
      </section>

      {heartbeats.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyDescription>
              {m.monitor_no_heartbeat_history()}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <section
            aria-labelledby="monitor-latency-heading"
            className="flex min-w-0 flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-medium" id="monitor-latency-heading">
                {m.monitor_latency()}
              </h2>
              <p className="text-sm text-muted-foreground">
                {m.monitor_latency_summary_description({
                  bucket: charts.bucketLabel,
                })}
              </p>
            </div>
            <LatencySummaryChart charts={charts} />
          </section>

          <section
            aria-labelledby="monitor-outcomes-heading"
            className="flex min-w-0 flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-medium" id="monitor-outcomes-heading">
                {m.monitor_outcome_breakdown()}
              </h2>
              <p className="text-sm text-muted-foreground">
                {charts.statusCodeSummary ??
                  m.monitor_outcome_breakdown_description()}
              </p>
            </div>
            <OutcomeBreakdownChart charts={charts} />
          </section>
        </>
      )}
    </div>
  );
}

function LatencySummaryChart({ charts }: { charts: MonitorChartData }) {
  if (charts.percentilePoints.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyDescription>
            {m.monitor_latency_summary_empty_description()}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ChartContainer
      className="h-80 min-h-80 w-full max-w-full"
      config={percentileChartConfig}
    >
      <LineChart
        accessibilityLayer
        data={charts.percentilePoints}
        margin={{ bottom: 8, left: 8, right: 24, top: 12 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="timestamp"
          domain={["dataMin", "dataMax"]}
          minTickGap={36}
          tickFormatter={formatChartTick}
          tickLine={false}
          type="number"
        />
        <YAxis
          axisLine={false}
          orientation="right"
          tickFormatter={(value) => m.common_ms({ value })}
          tickLine={false}
          width={56}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatChartTooltipTime(value)}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {charts.incidentMarkers.map((incident) => (
          <ReferenceArea
            ifOverflow="visible"
            key={incident.id}
            x1={incident.start}
            x2={incident.end}
          />
        ))}
        <Line
          dataKey="p50"
          dot={false}
          isAnimationActive={false}
          stroke="var(--color-p50)"
          strokeWidth={2}
          type="monotone"
        />
        <Line
          dataKey="p95"
          dot={false}
          isAnimationActive={false}
          stroke="var(--color-p95)"
          strokeWidth={2}
          type="monotone"
        />
        <Line
          dataKey="avg"
          dot={false}
          isAnimationActive={false}
          stroke="var(--color-avg)"
          strokeWidth={1.5}
          type="monotone"
        />
      </LineChart>
    </ChartContainer>
  );
}

function OutcomeBreakdownChart({ charts }: { charts: MonitorChartData }) {
  return (
    <ChartContainer
      className="h-64 min-h-64 w-full max-w-full"
      config={outcomeChartConfig}
    >
      <BarChart
        accessibilityLayer
        data={charts.outcomePoints}
        margin={{ bottom: 8, left: 4, right: 28, top: 8 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="status"
          interval={0}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          orientation="right"
          tickLine={false}
          width={42}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" isAnimationActive={false} radius={[4, 4, 0, 0]}>
          {charts.outcomePoints.map((point) => (
            <Cell fill={point.fill} key={point.status} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function deriveMonitorCharts({
  heartbeats,
  incidents,
  monitorKind,
}: {
  heartbeats: HeartbeatRecord[];
  incidents: IncidentRecord[];
  monitorKind: MonitorKind;
}): MonitorChartData {
  const sortedHeartbeats = [...heartbeats].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  const latencyPoints = sortedHeartbeats
    .filter(hasUsableDuration)
    .map((heartbeat) => {
      const timestamp = new Date(heartbeat.createdAt).getTime();
      return {
        timestamp,
        timeLabel: formatChartTooltipTime(timestamp),
        latencyMs: heartbeat.durationMs,
      };
    });
  const bucket = selectLatencyBucket(latencyPoints.length);

  return {
    latencyPoints,
    percentilePoints: buildPercentileSeries(latencyPoints, bucket.ms),
    outcomePoints: buildOutcomePoints(sortedHeartbeats),
    incidentMarkers: buildIncidentMarkers(incidents, latencyPoints),
    statusCodeSummary:
      monitorKind === "http" ? buildStatusCodeSummary(sortedHeartbeats) : null,
    bucketLabel: bucket.label,
  };
}

function hasUsableDuration(
  heartbeat: HeartbeatRecord,
): heartbeat is HeartbeatRecord & { durationMs: number } {
  return (
    heartbeat.status === "up" &&
    heartbeat.durationMs !== null &&
    Number.isFinite(heartbeat.durationMs) &&
    heartbeat.durationMs >= 0
  );
}

function selectLatencyBucket(pointCount: number) {
  if (pointCount <= 96) {
    return { label: m.monitor_latency_sample_bucket(), ms: 0 };
  }
  if (pointCount <= 288) {
    return { label: m.monitor_latency_15_minute_bucket(), ms: 15 * 60 * 1000 };
  }
  return { label: m.monitor_latency_1_hour_bucket(), ms: 60 * 60 * 1000 };
}

function buildPercentileSeries(points: LatencyPoint[], bucketMs: number) {
  if (bucketMs === 0) {
    return points.map((point) => ({
      timestamp: point.timestamp,
      timeLabel: point.timeLabel,
      p50: point.latencyMs,
      p95: point.latencyMs,
      avg: point.latencyMs,
    }));
  }

  const buckets = new Map<number, number[]>();

  for (const point of points) {
    const bucketStart = Math.floor(point.timestamp / bucketMs) * bucketMs;
    const values = buckets.get(bucketStart) ?? [];
    values.push(point.latencyMs);
    buckets.set(bucketStart, values);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left - right)
    .map(([timestamp, values]) => {
      const sorted = [...values].sort((left, right) => left - right);
      return {
        timestamp,
        timeLabel: formatChartTooltipTime(timestamp),
        p50: percentile(sorted, 0.5) ?? 0,
        p95: percentile(sorted, 0.95) ?? 0,
        avg: Math.round(
          sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
        ),
      };
    });
}

function buildOutcomePoints(heartbeats: HeartbeatRecord[]): OutcomePoint[] {
  const counts = heartbeats.reduce(
    (totals, heartbeat) => {
      totals[heartbeat.status] += 1;
      return totals;
    },
    { up: 0, down: 0, unknown: 0 },
  );

  return [
    { status: m.common_up(), count: counts.up, fill: "var(--color-up)" },
    { status: m.common_down(), count: counts.down, fill: "var(--color-down)" },
    {
      status: m.common_unknown(),
      count: counts.unknown,
      fill: "var(--color-unknown)",
    },
  ];
}

function buildIncidentMarkers(
  incidents: IncidentRecord[],
  latencyPoints: LatencyPoint[],
) {
  const first = latencyPoints[0]?.timestamp;
  const last = latencyPoints[latencyPoints.length - 1]?.timestamp;

  if (first == null || last == null) {
    return [];
  }

  return incidents
    .map((incident) => {
      const opened = new Date(incident.openedAt).getTime();
      const closed = incident.closedAt
        ? new Date(incident.closedAt).getTime()
        : last;
      return {
        id: incident.id,
        start: Math.max(opened, first),
        end: Math.min(closed, last),
      };
    })
    .filter((incident) => incident.start <= last && incident.end >= first);
}

function buildStatusCodeSummary(heartbeats: HeartbeatRecord[]) {
  const grouped = new Map<string, number>();

  for (const heartbeat of heartbeats) {
    if (heartbeat.statusCode == null) {
      continue;
    }
    const bucket = `${Math.floor(heartbeat.statusCode / 100)}xx`;
    grouped.set(bucket, (grouped.get(bucket) ?? 0) + 1);
  }

  if (grouped.size === 0) {
    return m.monitor_outcome_breakdown_description();
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bucket, count]) => `${bucket}: ${count}`)
    .join(" · ");
}

function formatChartTick(value: number | string) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatChartTooltipTime(
  value: number | string | readonly (number | string)[] | null | undefined,
) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return null;
  }
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(values.length * ratio) - 1),
  );
  return values[index] ?? null;
}
