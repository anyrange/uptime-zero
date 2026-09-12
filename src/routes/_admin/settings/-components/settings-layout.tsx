import { type ReactNode } from "react";

export function SettingsPanel({ children }: { children: ReactNode }) {
  return <div className="grid gap-0 rounded-xl border">{children}</div>;
}

export function SettingsRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 border-b px-4 py-3.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center md:has-[[data-slot=settings-row-action]]:py-4">
      {children}
    </div>
  );
}

export function SettingsRowContent({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

export function SettingsRowLabel({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-medium text-foreground">{children}</h3>;
}

export function SettingsRowDescription({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p>
  );
}

export function SettingsRowAction({ children }: { children: ReactNode }) {
  return (
    <div className="flex md:justify-end" data-slot="settings-row-action">
      {children}
    </div>
  );
}
