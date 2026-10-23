import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";

import type { SettingsOverview } from "@/lib/api/settings";

import { Button } from "@/components/ui/button";
import {
  useExportMonitorsMutation,
  useImportMonitorsMutation,
} from "@/lib/api/monitors";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { readMonitorExportFile } from "@/lib/monitor/export-file";
import { m } from "@/paraglide/messages.js";

import {
  SettingsPanel,
  SettingsRow,
  SettingsRowAction,
  SettingsRowContent,
  SettingsRowDescription,
  SettingsRowLabel,
} from "./settings-layout";

export function DataSettings({ data }: { data: SettingsOverview }) {
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

    const payload = await readMonitorExportFile(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (!payload) {
      setImportError(m.settings_import_failed());

      return;
    }

    // Server failures render from `importMonitors.error`.
    importMonitors.mutate(payload);
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
