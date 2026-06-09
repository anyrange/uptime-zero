export const MONITOR_LOGS_PAGE_SIZE = 25;

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
