import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useId, useState } from "react";

import type { NotificationDestinationMonitorSummary } from "@/types";

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
  notificationQueryOptions,
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
  return (
    <Sheet
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      open={Boolean(editingId)}
    >
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
        {editingId ? (
          // Keyed so each destination starts with fresh form and error state.
          <Suspense
            fallback={
              <div className="px-6 py-6">
                <NotificationsSkeleton />
              </div>
            }
            key={editingId}
          >
            <EditNotificationForm
              id={editingId}
              monitors={monitors}
              onClose={onClose}
            />
          </Suspense>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function EditNotificationForm({
  id,
  monitors,
  onClose,
}: {
  id: string;
  monitors: NotificationDestinationMonitorSummary[];
  onClose: () => void;
}) {
  const { data: destination } = useSuspenseQuery(notificationQueryOptions(id));
  const update = useUpdateNotificationMutation(id);
  const test = useTestNotificationMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formId = useId();
  const pending = update.isPending || test.isPending;

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
    <>
      <NotificationForm
        defaultState={notificationFormStateFromDestination(destination)}
        formId={formId}
        lockedProvider
        monitors={monitors}
        onInvalid={() => setSubmitError(m.notification_complete_required())}
        onSubmit={handleSubmit}
        submitError={submitError}
      />
      <SheetFooter className="gap-2 px-6 pb-6 sm:justify-between">
        <div>
          <Button
            disabled={pending}
            onClick={() => test.mutate(id)}
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
    </>
  );
}
