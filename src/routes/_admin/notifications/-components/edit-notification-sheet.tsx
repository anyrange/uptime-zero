import { useEffect, useId, useState } from "react";

import type { NotificationDestinationMonitorSummary } from "@/types";

import { Error as ErrorState } from "@/components/error";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useNotificationQuery,
  useTestNotificationMutation,
  useUpdateNotificationMutation,
  type NotificationPayload,
} from "@/lib/queries/notifications";
import { m } from "@/paraglide/messages.js";

import {
  notificationFormStateFromDestination,
  NotificationForm,
} from "./notification-form";
import { NotificationsSkeleton } from "./notifications-skeleton";

export function EditNotificationSheet({
  editingId,
  monitors,
  onClose,
}: {
  editingId: string | null;
  monitors: NotificationDestinationMonitorSummary[];
  onClose: () => void;
}) {
  const detail = useNotificationQuery(editingId);
  const update = useUpdateNotificationMutation(editingId ?? "");
  const test = useTestNotificationMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const open = Boolean(editingId);
  const formId = useId();
  const destination =
    detail.status === "success" && detail.data.id === editingId
      ? detail.data
      : null;
  const pending = update.isPending || test.isPending;

  useEffect(() => {
    if (open) {
      setSubmitError(null);
    }
  }, [editingId, open]);

  async function handleSubmit(payload: NotificationPayload) {
    setSubmitError(null);

    try {
      await update.mutateAsync(payload);
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : m.notification_save_failed(),
      );
    }
  }

  return (
    <Sheet onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <SheetContent
        className="w-full overflow-y-auto sm:!max-w-2xl"
        side="right"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>{m.notification_edit()}</SheetTitle>
          <SheetDescription>
            {m.notification_form_description()}
          </SheetDescription>
        </SheetHeader>

        {destination ? (
          <NotificationForm
            defaultState={notificationFormStateFromDestination(destination)}
            formId={formId}
            lockedProvider
            monitors={monitors}
            onInvalid={() => setSubmitError(m.notification_complete_required())}
            onSubmit={handleSubmit}
            submitError={submitError}
          />
        ) : detail.status === "error" ? (
          <div className="px-6 py-6">
            <ErrorState message={detail.error.message} />
          </div>
        ) : (
          <div className="px-6 py-6">
            <NotificationsSkeleton />
          </div>
        )}
        {destination ? (
          <SheetFooter className="gap-2 px-6 pb-6 sm:justify-between">
            <div>
              <Button
                disabled={pending || !editingId}
                onClick={() => editingId && test.mutate(editingId)}
                type="button"
                variant="outline"
              >
                {m.notification_send_test()}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={onClose} type="button" variant="outline">
                {m.common_cancel()}
              </Button>
              <Button disabled={pending} form={formId} type="submit">
                {m.notification_save_notifier()}
              </Button>
            </div>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
