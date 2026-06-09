import { useEffect, useState } from "react";

import { formatIncidentDuration } from "@/lib/formatters";

type IncidentDurationValue = {
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  durationMs?: number | null;
};

export function IncidentDuration({
  className,
  incident,
}: {
  className?: string;
  incident: IncidentDurationValue;
}) {
  useLiveDuration(incident.status === "open");

  return <span className={className}>{formatIncidentDuration(incident)}</span>;
}

function useLiveDuration(enabled: boolean) {
  const [, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled]);
}
