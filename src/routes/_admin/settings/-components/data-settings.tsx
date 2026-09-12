import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";

import type { SettingsData } from "@/types";

import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  monitorImportSchema,
  useExportMonitorsMutation,
  useImportMonitorsMutation,
} from "@/lib/queries/settings";
import { m } from "@/paraglide/messages.js";

import {
  SettingsPanel,
  SettingsRow,
  SettingsRowAction,
  SettingsRowContent,
  SettingsRowDescription,
  SettingsRowLabel,
} from "./settings-layout";

export function DataSettings({ data }: { data: SettingsData }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMonitors = useExportMonitorsMutation();
  const importMonitors = useImportMonitorsMutation();
  const { check, isReady } = usePermissions();
  const canImport = isReady && check("monitor.import");
  const [importError, setImportError] = useState<string | null>(null);

  async function handleExport() {
    const exported = await exportMonitors.mutateAsync();

    const blob = new Blob([JSON.stringify(exported, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `uptime-monitors-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    setImportError(null);

    try {
      const payload = monitorImportSchema.parse(JSON.parse(await file.text()));
      await importMonitors.mutateAsync(payload);
    } catch (error) {
      const parsedError = z.object({ message: z.string() }).safeParse(error);
      setImportError(
        parsedError.success
          ? parsedError.data.message
          : m.settings_import_failed(),
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const importedCount = importMonitors.data?.imported;

  return (
    <SettingsPanel>
      <SettingsRow>
        <SettingsRowContent>
          <SettingsRowLabel>{m.settings_export_monitors()}</SettingsRowLabel>
          <SettingsRowDescription>
            {m.settings_export_monitors_description({
              count: data.monitors.length,
            })}
          </SettingsRowDescription>
        </SettingsRowContent>
        <SettingsRowAction>
          <Button
            disabled={exportMonitors.isPending}
            onClick={() => void handleExport()}
            type="button"
            variant="outline"
          >
            <Download className="size-4" />
            {m.settings_export()}
          </Button>
        </SettingsRowAction>
      </SettingsRow>
      {canImport ? (
        <SettingsRow>
          <SettingsRowContent>
            <SettingsRowLabel>{m.settings_import_monitors()}</SettingsRowLabel>
            <SettingsRowDescription>
              {m.settings_import_monitors_description()}
            </SettingsRowDescription>
            {importedCount ? (
              <p className="mt-2 text-sm text-primary">
                {m.settings_imported_monitors({ count: importedCount })}
              </p>
            ) : null}
            {importError || importMonitors.error ? (
              <p className="mt-2 text-sm text-destructive">
                {importError ?? errorMessage(importMonitors.error)}
              </p>
            ) : null}
          </SettingsRowContent>
          <SettingsRowAction>
            <input
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) =>
                void handleImport(event.currentTarget.files?.[0])
              }
              ref={fileInputRef}
              type="file"
            />
            <Button
              disabled={importMonitors.isPending}
              onClick={() => fileInputRef.current?.click()}
              type="button"
              variant="outline"
            >
              <Upload className="size-4" />
              {m.settings_import()}
            </Button>
          </SettingsRowAction>
        </SettingsRow>
      ) : null}
    </SettingsPanel>
  );
}

function errorMessage(error: Error | null) {
  return error?.message || m.settings_import_failed();
}
