import { Webhook } from "lucide-react";

import type { NotificationProvider } from "@/types";

import { Discord } from "@/components/ui/svgs/discord";
import { Telegram } from "@/components/ui/svgs/telegram";

export function NotificationProviderIcon({
  provider,
  size = "md",
}: {
  provider: NotificationProvider;
  size?: "sm" | "md";
}) {
  const className = size === "sm" ? "size-4" : "size-5";

  return (
    <span className="flex size-6 shrink-0 items-center justify-center">
      {provider === "discord" ? (
        <Discord aria-hidden="true" className={className} />
      ) : provider === "telegram" ? (
        <Telegram aria-hidden="true" className={className} />
      ) : (
        <Webhook
          aria-hidden="true"
          className={`${className} text-muted-foreground`}
        />
      )}
    </span>
  );
}
