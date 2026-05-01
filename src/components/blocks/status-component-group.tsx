"use client";

import { useEffect, useState } from "react";

import type { StatusType } from "@/components/blocks/status.types";

import {
  StatusComponentIcon,
  StatusComponentStatus,
} from "@/components/blocks/status-component";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function StatusComponentGroup({
  children,
  title,
  status,
  className,
  defaultOpen = false,
  ...props
}: React.ComponentProps<"div"> & {
  title: string;
  status?: Exclude<StatusType, "empty">;
  defaultOpen?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div {...props}>
      <Collapsible
        className={cn(
          "rounded-xl border border-border/60 bg-card/50 shadow-sm transition data-[state=open]:bg-card/70",
          className,
        )}
        data-slot="status-component-group"
        defaultOpen={defaultOpen}
      >
        <CollapsibleTrigger
          aria-label={m.status_block_toggle_details({ title })}
          className="group/component flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
          data-slot="status-component-group-trigger"
          data-variant={status}
        >
          <div className="flex min-w-0 items-center gap-3">
            <StatusComponentIcon />
            <div>
              <div className="text-sm font-medium text-foreground">{title}</div>
            </div>
          </div>
          <StatusComponentStatus />
        </CollapsibleTrigger>
        <CollapsibleContent
          className={cn(
            "overflow-hidden border-t border-border/50 px-4 py-3",
            "data-[animate=true]:data-[state=closed]:animate-collapsible-up data-[animate=true]:data-[state=open]:animate-collapsible-down",
          )}
          data-animate={mounted}
          data-slot="status-component-group-content"
        >
          <div className="grid gap-3">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
