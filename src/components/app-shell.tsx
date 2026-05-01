import type { ReactNode } from "react";

import { useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useMemo, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { m } from "@/paraglide/messages.js";

type AppShellTitleContextValue = {
  setTitle: (title: string | null) => void;
};

const AppShellTitleContext = createContext<AppShellTitleContextValue | null>(
  null,
);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const fallbackTitle = getAppShellTitle(pathname);
  const title = titleOverride ?? fallbackTitle;
  const contextValue = useMemo(
    () => ({ setTitle: setTitleOverride }),
    [setTitleOverride],
  );

  return (
    <AppShellTitleContext.Provider value={contextValue}>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "18rem",
            "--header-height": "3.25rem",
          } as React.CSSProperties
        }
      >
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex min-w-0 items-center gap-2 px-4 lg:px-6">
              <SidebarTrigger className="-ml-1" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{title}</p>
              </div>
            </div>
          </header>
          <main className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col px-4 py-4 lg:px-6">
              {children}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AppShellTitleContext.Provider>
  );
}

export function useAppShellTitle() {
  const context = useContext(AppShellTitleContext);

  if (!context) {
    throw new Error("useAppShellTitle must be used within AppShell.");
  }

  return context;
}

function getAppShellTitle(pathname: string) {
  if (pathname.startsWith("/monitors/new")) {
    return m.monitor_new();
  }

  if (pathname.startsWith("/monitors/") && pathname.endsWith("/edit")) {
    return m.monitor_edit();
  }

  if (pathname.startsWith("/monitors/")) {
    return m.monitor_monitor();
  }

  if (pathname === "/monitors") {
    return m.monitor_monitors();
  }

  if (pathname === "/") {
    return m.overview_title();
  }

  if (pathname.startsWith("/incidents")) {
    return m.incident_history();
  }

  if (pathname.startsWith("/status-pages/new")) {
    return m.status_page_new();
  }

  if (pathname.startsWith("/status-pages/") && pathname.endsWith("/edit")) {
    return m.status_page_edit();
  }

  if (pathname.startsWith("/status-pages")) {
    return m.status_page_status_pages();
  }

  if (pathname.startsWith("/settings")) {
    return m.settings_workspace_configuration();
  }

  return m.common_dashboard();
}
