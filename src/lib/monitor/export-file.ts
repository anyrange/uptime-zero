import {
  MonitorExport,
  type MonitorExportInput,
} from "@/lib/schemas/monitor-config";

function isMonitorExport(json: unknown): json is MonitorExportInput {
  return MonitorExport.safeParse(json).success;
}

/**
 * Reads an uploaded monitor export, or null when it isn't one. The parsed
 * JSON is returned as-is: it is already the input the import server function
 * accepts, and the server parses it again.
 */
export async function readMonitorExportFile(file: File) {
  let json: unknown;

  try {
    json = JSON.parse(await file.text());
  } catch {
    return null;
  }

  return isMonitorExport(json) ? json : null;
}
