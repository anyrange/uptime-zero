import { Card } from "@/components/ui/card";
import { m } from "@/paraglide/messages.js";

export function Loading() {
  return (
    <Card className="px-5 py-8 text-sm text-muted-foreground">
      {m.common_loading()}
    </Card>
  );
}
