import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import {
  Bell,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  LogIn,
  LogOut,
  MoreVertical,
  RadioTower,
  Settings,
  User,
} from "lucide-react";

import type { SessionData } from "@/types";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogoutMutation, useSessionQuery } from "@/lib/queries/auth";
import { m } from "@/paraglide/messages.js";

export function AppSidebar() {
  const session = useSessionQuery();
  const logout = useLogoutMutation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={m.common_edge_uptime()}
            >
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <RadioTower className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {m.common_edge_uptime()}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {m.common_edge_monitoring()}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{m.nav_monitoring()}</SidebarGroupLabel>
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
                  search={{ monitor: undefined, q: undefined, status: "all" }}
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{m.nav_operations()}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
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
      </SidebarContent>
      <SidebarFooter>
        <SessionFooter
          isLoggingOut={logout.isPending}
          onLogout={() => logout.mutate()}
          session={session}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
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
    const primaryLabel = name || user.email || m.auth_signed_in();
    const secondaryLabel = name
      ? user.email || m.auth_administrator()
      : user.email
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
                  <span>Account settings</span>
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
