import dayjs, { type ConfigType } from "dayjs";
import duration from "dayjs/plugin/duration";
import localizedFormat from "dayjs/plugin/localizedFormat";
import utc from "dayjs/plugin/utc";

dayjs.extend(duration);
dayjs.extend(localizedFormat);
dayjs.extend(utc);

export function parseDateMs(value: ConfigType): number {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.valueOf() : Number.NaN;
}

export function nowMs(): number {
  return dayjs().valueOf();
}

export function nowIso(): string {
  return dayjs.utc().toISOString();
}

export function daysAgoMs(days: number): number {
  return dayjs().subtract(days, "day").valueOf();
}

export function daysAgoIso(days: number): string {
  return dayjs.utc().subtract(days, "day").toISOString();
}

export function hoursAgoIso(hours: number): string {
  return dayjs.utc().subtract(hours, "hour").toISOString();
}

export function formatDateTimeValue(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    return "Invalid date";
  }

  return parsed.format("ll LT");
}

export function formatDurationRange(
  start: string,
  end?: string | null,
): string {
  const startTime = parseDateMs(start);
  const endTime = end ? parseDateMs(end) : nowMs();
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    endTime < startTime
  ) {
    return "N/A";
  }

  const span = dayjs.duration(endTime - startTime);
  const days = Math.floor(span.asDays());
  const hours = span.hours();
  const minutes = span.minutes();
  const seconds = span.seconds();

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}
