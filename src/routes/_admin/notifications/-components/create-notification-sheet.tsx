import { useEffect, useId, useState } from "react";

import type {
  NotificationDestinationMonitorSummary,
  NotificationProvider,
} from "@/types";

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
  useCreateNotificationMutation,
  type NotificationPayload,
} from "@/lib/queries/notifications";
import { m } from "@/paraglide/messages.js";

import {
  emptyNotificationFormState,
  NotificationForm,
} from "./notification-form";

export function CreateNotificationSheet({
  provider,
  monitors,
  onClose,
}: {
  provider: NotificationProvider | null;
  monitors: NotificationDestinationMonitorSummary[];
  onClose: () => void;
}) {
  const create = useCreateNotificationMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const open = Boolean(provider);
  const formId = useId();

  useEffect(() => {
    if (open) {
      setSubmitError(null);
    }
  }, [open, provider]);

  async function handleSubmit(payload: NotificationPayload) {
    setSubmitError(null);

    try {
      await create.mutateAsync(payload);
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
          <SheetTitle>{m.notification_create_new()}</SheetTitle>
          <SheetDescription>
            {m.notification_form_description()}
          </SheetDescription>
        </SheetHeader>

        {provider ? (
          <NotificationForm
            defaultState={emptyNotificationFormState(provider)}
            formId={formId}
            monitors={monitors}
            onInvalid={() => setSubmitError(m.notification_complete_required())}
            onSubmit={handleSubmit}
            submitError={submitError}
          />
        ) : null}
        {provider ? (
          <SheetFooter className="gap-2 px-6 pb-6 sm:justify-end">
            <Button onClick={onClose} type="button" variant="outline">
              {m.common_cancel()}
            </Button>
            <Button disabled={create.isPending} form={formId} type="submit">
              {m.notification_create_new()}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
