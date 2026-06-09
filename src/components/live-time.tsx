import { useEffect, useState } from "react";

import { formatDateTime, formatRelativeDateTime } from "@/lib/formatters";

type LiveTimeProps = {
  value: string | null | undefined;
  className?: string;
  mode?: "relative" | "absolute";
};

export function LiveTime({
  value,
  className,
  mode = "relative",
}: LiveTimeProps) {
  const now = useNow(mode === "relative" ? 1000 : null);
  const label =
    mode === "relative"
      ? formatRelativeDateTime(value, now)
      : formatDateTime(value);

  return (
    <time
      className={className}
      dateTime={value ?? undefined}
      title={formatDateTime(value)}
    >
      {label}
    </time>
  );
}

function useNow(intervalMs: number | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (intervalMs == null) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);

  return now;
}
