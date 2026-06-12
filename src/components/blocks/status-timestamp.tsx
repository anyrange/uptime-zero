"use client";

import { format } from "date-fns";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function StatusTimestamp({
  date,
  className,
  children,
}: React.ComponentProps<"span"> & {
  date: Date;
  variant?: "simple" | "rich";
}) {
  const utc = `${format(date, "MMM dd, yyyy HH:mm")} UTC`;
  const fullDate = format(date, "PP pp");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "text-muted-foreground underline decoration-dashed underline-offset-4",
              className,
            )}
          >
            {children ?? utc}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{fullDate}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
