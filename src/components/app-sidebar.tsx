import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Link, useRouter } from "@tanstack/react-router";
import {
  Bell,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  LogIn,
  LogOut,
  MoreVertical,
  Plus,
  RadioTower,
  Settings,
  User,
} from "lucide-react";

import type { MonitorStatus, SessionData } from "@/types";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { appVersion } from "@/lib/build-info";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { useLogoutMutation, useSessionQuery } from "@/lib/queries/auth";
import { useDashboardQuery } from "@/lib/queries/dashboard";
import { m } from "@/paraglide/messages.js";

export function AppSidebar() {
  const router = useRouter();
  const session = useSessionQuery();
  const logout = useLogoutMutation();
  const dashboard = useDashboardQuery();
  const { check, isReady } = usePermissions();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pb-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={m.common_edge_uptime()}
            >
              <Link to="/">
                <img
                  alt={m.common_edge_uptime()}
                  className="aspect-square size-8 rounded-lg"
                  src="/logo.svg"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {m.common_edge_uptime()}
                  </span>
                  <span
                    aria-label={m.common_app_version({ version: appVersion })}
                    className="truncate text-xs text-muted-foreground"
                  >
                    {appVersion}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{m.nav_workspace()}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem tooltip={m.nav_overview()}>
                <Link
                  activeOptions={{ exact: true }}
                  activeProps={{
                    className:
                      "bg-sidebar-accent text-sidebar-accent-foreground",
                  }}
                  to="/"
                >
                  <LayoutDashboard />
                  <span>{m.nav_overview()}</span>
                </Link>
              </NavItem>
              <NavItem tooltip={m.nav_monitors()}>
                <Link
                  activeProps={{
                    className:
                      "bg-sidebar-accent text-sidebar-accent-foreground",
                  }}
                  to="/monitors"
                >
                  <RadioTower />
                  <span>{m.nav_monitors()}</span>
                </Link>
              </NavItem>
              <NavItem tooltip={m.nav_incidents()}>
                <Link
                  activeProps={{
                    className:
                      "bg-sidebar-accent text-sidebar-accent-foreground",
                  }}
                  to="/incidents"
                >
                  <ClipboardList />
                  <span>{m.nav_incidents()}</span>
                </Link>
              </NavItem>
              <NavItem tooltip={m.nav_status_pages()}>
                <Link
                  activeProps={{
                    className:
                      "bg-sidebar-accent text-sidebar-accent-foreground",
                  }}
                  to="/status-pages"
                >
                  <Gauge />
                  <span>{m.nav_status_pages()}</span>
                </Link>
              </NavItem>
              <NavItem tooltip={m.nav_notifications()}>
                <Link
                  activeProps={{
                    className:
                      "bg-sidebar-accent text-sidebar-accent-foreground",
                  }}
                  to="/notifications"
                >
                  <Bell />
                  <span>{m.nav_notifications()}</span>
                </Link>
              </NavItem>
              <NavItem tooltip={m.nav_settings()}>
                <Link
                  activeProps={{
                    className:
                      "bg-sidebar-accent text-sidebar-accent-foreground",
                  }}
                  to="/settings"
                >
                  <Settings />
                  <span>{m.nav_settings()}</span>
                </Link>
              </NavItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarResourceGroup
          addLabel={m.nav_add_status_page()}
          addTo="/status-pages/new"
          canAdd={isReady && check("statusPage.create")}
          emptyLabel={m.nav_no_status_pages()}
          label={m.nav_status_pages_count({
            count: dashboard.data?.statusPages.length ?? 0,
          })}
          loading={dashboard.status === "pending"}
        >
          {dashboard.data?.statusPages.map((page) => (
            <SidebarMenuItem key={page.id}>
              <SidebarMenuButton asChild tooltip={page.title}>
                <Link
                  activeProps={{
                    className:
                      "bg-sidebar-accent text-sidebar-accent-foreground",
                  }}
                  params={{ pageId: page.id }}
                  to="/status-pages/$pageId/edit"
                >
                  <span>{page.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarResourceGroup>
        <SidebarResourceGroup
          addLabel={m.nav_add_monitor()}
          addTo="/monitors/new"
          canAdd={isReady && check("monitor.create")}
          emptyLabel={m.nav_no_monitors()}
          label={m.nav_monitors_count({
            count: dashboard.data?.monitors.length ?? 0,
          })}
          loading={dashboard.status === "pending"}
        >
          {dashboard.data?.monitors.map((monitor) => {
            const status =
              monitor.active === 1 ? monitor.lastStatus : "unknown";

            return (
              <SidebarMenuItem key={monitor.id}>
                <SidebarMenuButton asChild tooltip={monitor.name}>
                  <Link
                    activeProps={{
                      className:
                        "bg-sidebar-accent text-sidebar-accent-foreground",
                    }}
                    params={{ monitorId: monitor.id }}
                    to="/monitors/$monitorId"
                  >
                    <span>{monitor.name}</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarMenuBadge>
                  <span
                    aria-label={getMonitorStatusLabel(status)}
                    className={`size-2 rounded-full ${getMonitorStatusClass(status)}`}
                    role="img"
                  />
                </SidebarMenuBadge>
              </SidebarMenuItem>
            );
          })}
        </SidebarResourceGroup>
      </SidebarContent>
      <SidebarFooter>
        <SessionFooter
          isLoggingOut={logout.isPending}
          onLogout={() =>
            logout.mutate(undefined, {
              onSuccess: async () => {
                await router.navigate({ replace: true, to: "/login" });
              },
            })
          }
          session={session}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function SidebarResourceGroup({
  label,
  addLabel,
  addTo,
  canAdd,
  emptyLabel,
  loading,
  children,
}: {
  label: string;
  addLabel: string;
  addTo: "/monitors/new" | "/status-pages/new";
  canAdd: boolean;
  emptyLabel: string;
  loading: boolean;
  children: ReactNode;
}) {
  const hasItems = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <div className="relative">
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        {canAdd ? (
          <Button
            aria-label={addLabel}
            asChild
            className="absolute top-0 right-1"
            size="icon-xs"
            variant="outline"
          >
            <Link to={addTo}>
              <Plus />
            </Link>
          </Button>
        ) : null}
      </div>
      <SidebarGroupContent>
        {loading ? (
          <div className="flex flex-col gap-2 px-2 py-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
          </div>
        ) : hasItems ? (
          <ScrollArea className="max-h-56">
            <SidebarMenu>{children}</SidebarMenu>
          </ScrollArea>
        ) : (
          <p className="px-2 py-1 text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function getMonitorStatusLabel(status: MonitorStatus) {
  if (status === "up") return m.common_up();
  if (status === "down") return m.common_down();
  return m.common_unknown();
}

function getMonitorStatusClass(status: MonitorStatus) {
  if (status === "up") return "bg-success";
  if (status === "down") return "bg-destructive";
  return "bg-muted-foreground";
}

function SessionFooter({
  session,
  onLogout,
  isLoggingOut,
}: {
  session: UseQueryResult<SessionData, Error>;
  onLogout: () => void;
  isLoggingOut: boolean;
}) {
  const { isMobile } = useSidebar();

  if (session.status === "pending") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-2 px-2 py-2">
            <Skeleton className="size-8 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-18" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (session.status === "success" && session.data.user) {
    const { user } = session.data;
    const name = user.name?.trim();
    const primaryLabel = name || m.auth_signed_in();
    const secondaryLabel = name
      ? m.auth_administrator()
      : m.auth_uptime_console();
    const initials = primaryLabel
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                size="lg"
                tooltip={m.auth_account()}
              >
                <Avatar>
                  <AvatarImage
                    alt={primaryLabel}
                    src={user.image ?? undefined}
                  />
                  <AvatarFallback>{initials || "UP"}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{primaryLabel}</span>
                  <span className="truncate text-xs">{secondaryLabel}</span>
                </div>
                <MoreVertical className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarImage
                      alt={primaryLabel}
                      src={user.image ?? undefined}
                    />
                    <AvatarFallback>{initials || "UP"}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {primaryLabel}
                    </span>
                    <span className="truncate text-xs">{secondaryLabel}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings/$section" params={{ section: "account" }}>
                  <User />
                  <span>{m.auth_account_settings()}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isLoggingOut}
                onSelect={(event) => {
                  event.preventDefault();
                  onLogout();
                }}
                variant="destructive"
              >
                <LogOut />
                <span>
                  {isLoggingOut ? m.auth_logging_out() : m.auth_log_out()}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={m.auth_admin_login()}>
          <Link to="/login">
            <LogIn />
            <span>{m.auth_admin_login()}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function NavItem({
  children,
  tooltip,
}: {
  children: ReactNode;
  tooltip: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={tooltip}>
        {children}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
