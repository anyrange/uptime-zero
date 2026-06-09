import dayjs, { type ConfigType } from "dayjs";
import utc from "dayjs/plugin/utc";

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
