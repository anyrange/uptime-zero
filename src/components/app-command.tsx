import { useHotkey } from "@tanstack/react-hotkeys";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ClipboardList,
  FilePlus2,
  Gauge,
  LayoutDashboard,
  Plus,
  RadioTower,
  Search,
  Settings,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { dashboardQueryOptions } from "@/lib/queries/dashboard";
import { m } from "@/paraglide/messages.js";

type CommandDestination = {
  id: string;
  label: string;
  keywords?: string[];
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  to: string;
};

export function AppCommand() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // The admin layout loads the dashboard, which already lists every monitor and
  // status page the palette links to.
  const { data: dashboard } = useSuspenseQuery(dashboardQueryOptions());

  const navigationItems = useMemo<CommandDestination[]>(
    () => [
      {
        id: "overview",
        label: m.command_open_overview(),
        icon: LayoutDashboard,
        to: "/",
      },
      {
        id: "monitors",
        label: m.command_open_monitors(),
        icon: RadioTower,
        to: "/monitors",
      },
      {
        id: "incidents",
        label: m.command_open_incidents(),
        icon: ClipboardList,
        to: "/incidents",
      },
      {
        id: "status-pages",
        label: m.command_open_status_pages(),
        icon: Gauge,
        to: "/status-pages",
      },
      {
        id: "notifications",
        label: m.command_open_notifications(),
        icon: Bell,
        to: "/notifications",
      },
      {
        id: "settings",
        label: m.command_open_settings(),
        icon: Settings,
        to: "/settings",
      },
    ],
    [],
  );

  const actionItems = useMemo<CommandDestination[]>(
    () => [
      {
        id: "new-monitor",
        label: m.command_create_monitor(),
        icon: Plus,
        to: "/monitors/new",
      },
      {
        id: "new-status-page",
        label: m.command_create_status_page(),
        icon: FilePlus2,
        to: "/status-pages/new",
      },
    ],
    [],
  );

  useHotkey(
    "Mod+K",
    () => {
      setOpen((value) => !value);
    },
    { preventDefault: true },
  );

  const selectDestination = (to: string) => {
    setOpen(false);
    void navigate({ to });
  };

  return (
    <>
      <Button
        aria-label={m.command_trigger()}
        className="ml-auto hidden h-8 w-56 justify-start gap-2 px-2.5 text-muted-foreground sm:flex lg:w-72"
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        <Search data-icon="inline-start" />
        <span className="min-w-0 flex-1 truncate text-left">
          {m.command_trigger()}
        </span>
        <kbd className="rounded-xl bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {m.command_shortcut()}
        </kbd>
      </Button>
      <Button
        aria-label={m.command_trigger()}
        className="ml-auto sm:hidden"
        onClick={() => setOpen(true)}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <Search />
      </Button>
      <CommandDialog
        description={m.command_description()}
        onOpenChange={setOpen}
        open={open}
        title={m.command_title()}
      >
        <Command>
          <CommandInput placeholder={m.command_placeholder()} />
          <CommandList>
            <CommandEmpty>{m.command_no_results()}</CommandEmpty>
            <CommandGroup heading={m.command_group_navigation()}>
              {navigationItems.map((item) => (
                <AppCommandItem
                  key={item.id}
                  item={item}
                  onSelect={selectDestination}
                />
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={m.command_group_actions()}>
              {actionItems.map((item) => (
                <AppCommandItem
                  key={item.id}
                  item={item}
                  onSelect={selectDestination}
                />
              ))}
            </CommandGroup>
            {dashboard.monitors.length ? (
              <>
                <CommandSeparator />
                <CommandGroup heading={m.command_group_monitors()}>
                  {dashboard.monitors.map((monitor) => (
                    <CommandItem
                      key={monitor.id}
                      keywords={[monitor.name, monitor.target, monitor.kind]}
                      onSelect={() =>
                        selectDestination(`/monitors/${monitor.id}`)
                      }
                      value={`monitor-${monitor.id}-${monitor.name}`}
                    >
                      <RadioTower />
                      <span className="truncate">
                        {m.command_open_monitor({ name: monitor.name })}
                      </span>
                      <CommandShortcut>{monitor.kind}</CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
            {dashboard.statusPages.length ? (
              <>
                <CommandSeparator />
                <CommandGroup heading={m.command_group_status_pages()}>
                  {dashboard.statusPages.map((page) => (
                    <CommandItem
                      key={page.id}
                      keywords={[page.title, page.slug]}
                      onSelect={() =>
                        selectDestination(`/status-pages/${page.id}/edit`)
                      }
                      value={`status-page-${page.id}-${page.title}`}
                    >
                      <Gauge />
                      <span className="truncate">
                        {m.command_open_status_page({ title: page.title })}
                      </span>
                      <CommandShortcut>{page.slug}</CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function AppCommandItem({
  item,
  onSelect,
}: {
  item: CommandDestination;
  onSelect: (to: string) => void;
}) {
  const Icon = item.icon;

  return (
    <CommandItem
      keywords={item.keywords}
      onSelect={() => onSelect(item.to)}
      value={`${item.id}-${item.label}`}
    >
      <Icon />
      <span>{item.label}</span>
    </CommandItem>
  );
}
