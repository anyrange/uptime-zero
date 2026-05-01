export const MONITOR_LOGS_PAGE_SIZE = 25;

export function normalizeMonitorLogsPage(
  input: number | string | null | undefined,
) {
  const value =
    typeof input === "number"
      ? input
      : typeof input === "string"
        ? Number.parseInt(input, 10)
        : Number.NaN;

  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    return 1;
  }

  return value;
}

export function clampMonitorLogsPage(page: number, totalPages: number) {
  if (totalPages < 1) {
    return 1;
  }

  return Math.min(Math.max(page, 1), totalPages);
}

export function getMonitorLogsPageRange({
  page,
  pageSize,
  total,
  resultCount,
}: {
  page: number;
  pageSize: number;
  total: number;
  resultCount: number;
}) {
  if (total === 0 || resultCount === 0) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = start + resultCount - 1;

  return {
    start,
    end,
  };
}
