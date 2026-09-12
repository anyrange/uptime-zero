import { toast } from "sonner";

import type { MonitorRecord } from "@/types";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { useRotatePushTokenMutation } from "@/lib/queries/monitors";
import { m } from "@/paraglide/messages.js";

export function PushEndpoint({ monitor }: { monitor: MonitorRecord }) {
  const rotate = useRotatePushTokenMutation(monitor.id);
  const permissions = usePermissions();

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{m.monitor_push_endpoint()}</CardTitle>
        <CardDescription>
          {m.monitor_push_endpoint_description()}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Textarea
          aria-label={m.monitor_push_endpoint()}
          readOnly
          value={`/api/push/${rotate.data?.pushToken ?? monitor.pushToken}`}
        />
        {permissions.check("monitor.update") ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={rotate.isPending}
              >
                {m.monitor_rotate_token()}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{m.monitor_rotate_token()}</AlertDialogTitle>
                <AlertDialogDescription>
                  {m.monitor_rotate_token_description()}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{m.common_cancel()}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    rotate.mutate(undefined, {
                      onSuccess: () => toast.success(m.monitor_token_rotated()),
                      onError: (error) => toast.error(error.message),
                    })
                  }
                >
                  {m.monitor_rotate_token()}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </CardContent>
    </Card>
  );
}
