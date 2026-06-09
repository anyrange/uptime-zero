import type { ComponentProps } from "react";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

type SensitiveInputProps = Omit<ComponentProps<typeof Input>, "type">;

export function SensitiveInput({ className, ...props }: SensitiveInputProps) {
  const [revealed, setRevealed] = useState(false);
  const label = revealed
    ? m.notification_hide_sensitive_field()
    : m.notification_show_sensitive_field();
  const Icon = revealed ? EyeOffIcon : EyeIcon;

  return (
    <div className="relative">
      <Input
        {...props}
        className={cn("pr-9", className)}
        type={revealed ? "text" : "password"}
      />
      <Button
        aria-label={label}
        className="absolute top-0 right-0 rounded-l-none text-muted-foreground hover:text-foreground"
        onClick={() => setRevealed((current) => !current)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Icon />
      </Button>
    </div>
  );
}
