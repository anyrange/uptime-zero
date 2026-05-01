import { connect as tlsConnect } from "node:tls";

import type {
  MonitorCheckResult,
  MonitorRecord,
  MonitorSslStatus,
} from "@/types";

import { parseDateMs } from "@/api/lib/dates";

const SSL_EXPIRY_THRESHOLD_DAYS = 14;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function getHttpsMonitorHostname(target: string): string | null {
  try {
    const url = new URL(target);
    return url.protocol === "https:" ? url.hostname : null;
  } catch {
    return null;
  }
}

export function parseCertValidTo(input: string): string | null {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export function getCertDaysRemaining(
  certValidToIso: string,
  nowMs = Date.now(),
): number {
  return Math.ceil((parseDateMs(certValidToIso) - nowMs) / ONE_DAY_MS);
}

export function getSslStatus(
  certValidToIso: string | null,
  nowMs = Date.now(),
  thresholdDays = SSL_EXPIRY_THRESHOLD_DAYS,
): MonitorSslStatus {
  if (!certValidToIso) {
    return "unavailable";
  }
  const daysRemaining = getCertDaysRemaining(certValidToIso, nowMs);
  if (daysRemaining <= 0) {
    return "expired";
  }
  if (daysRemaining < thresholdDays) {
    return "expiring";
  }
  return "valid";
}

export async function probeMonitorSsl(
  target: string,
  timeoutMs: number,
  nowMs = Date.now(),
): Promise<
  Pick<
    MonitorCheckResult,
    "hostname" | "certValidTo" | "certDaysRemaining" | "sslStatus"
  >
> {
  const hostname = getHttpsMonitorHostname(target);
  if (!hostname || timeoutMs <= 0) {
    return unavailableSslProbe(hostname);
  }

  const url = new URL(target);
  const port = url.port ? Number.parseInt(url.port, 10) : 443;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (
      payload: Pick<
        MonitorCheckResult,
        "hostname" | "certValidTo" | "certDaysRemaining" | "sslStatus"
      >,
    ) => {
      if (settled) return;
      settled = true;
      socket?.destroy();
      resolve(payload);
    };

    let socket: ReturnType<typeof tlsConnect> | undefined;

    try {
      socket = tlsConnect({
        host: hostname,
        port,
        servername: hostname,
      });
    } catch {
      finish(unavailableSslProbe(hostname));
      return;
    }

    socket.setTimeout(timeoutMs, () => {
      finish(unavailableSslProbe(hostname));
    });

    socket.once("error", () => {
      finish(unavailableSslProbe(hostname));
    });

    socket.once("secureConnect", () => {
      const certificate = socket.getPeerCertificate();
      const certValidTo = parseCertValidTo(certificate?.valid_to ?? "");
      const certDaysRemaining = certValidTo
        ? getCertDaysRemaining(certValidTo, nowMs)
        : null;
      finish({
        hostname,
        certValidTo,
        certDaysRemaining,
        sslStatus: getSslStatus(certValidTo, nowMs),
      });
    });
  });
}

export function mergeHttpAndSslResult(
  httpResult: MonitorCheckResult,
  sslResult: Pick<
    MonitorCheckResult,
    "hostname" | "certValidTo" | "certDaysRemaining" | "sslStatus"
  >,
): MonitorCheckResult {
  const merged: MonitorCheckResult = {
    ...httpResult,
    ...sslResult,
  };

  if (httpResult.status === "down") {
    return merged;
  }

  if (sslResult.sslStatus === "expired") {
    return {
      ...merged,
      status: "down",
      error: "SSL certificate has expired",
    };
  }

  if (
    sslResult.sslStatus === "expiring" &&
    typeof sslResult.certDaysRemaining === "number"
  ) {
    return {
      ...merged,
      status: "down",
      error: `SSL certificate expires in ${sslResult.certDaysRemaining} days`,
    };
  }

  return merged;
}

export function getMonitorSslDetails(monitor: MonitorRecord): {
  hostname: string;
  validUntilLabel: string;
  remainingLabel: string | null;
  sslStatus: MonitorSslStatus;
} | null {
  if (!monitor.target.startsWith("https://")) {
    return null;
  }

  const hostname =
    monitor.lastCertHostname || readHostnameFromTarget(monitor.target);
  const sslStatus = monitor.lastSslStatus ?? "unavailable";

  return {
    hostname: hostname ?? "Unavailable",
    validUntilLabel: monitor.lastCertValidTo
      ? monitor.lastCertValidTo
      : "Unavailable",
    remainingLabel:
      typeof monitor.lastCertDaysRemaining === "number"
        ? formatCertDaysRemaining(monitor.lastCertDaysRemaining)
        : null,
    sslStatus,
  };
}

function unavailableSslProbe(
  hostname: string | null,
): Pick<
  MonitorCheckResult,
  "hostname" | "certValidTo" | "certDaysRemaining" | "sslStatus"
> {
  return {
    hostname,
    certValidTo: null,
    certDaysRemaining: null,
    sslStatus: "unavailable",
  };
}

function readHostnameFromTarget(target: string): string | null {
  try {
    return new URL(target).hostname;
  } catch {
    return null;
  }
}

function formatCertDaysRemaining(daysRemaining: number): string {
  if (daysRemaining <= 0) {
    return "Expired";
  }
  return `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`;
}
