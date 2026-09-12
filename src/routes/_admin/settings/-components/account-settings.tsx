import { useForm } from "@tanstack/react-form";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import type { AccountData } from "@/types";

import { Error } from "@/components/error";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { firstFieldError } from "@/lib/form-errors";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  useAccountQuery,
  useDeleteAccountMutation,
  useUpdateAccountMutation,
} from "@/lib/queries/auth";
import { m } from "@/paraglide/messages.js";

import {
  SettingsPanel,
  SettingsRow,
  SettingsRowAction,
  SettingsRowContent,
  SettingsRowDescription,
  SettingsRowLabel,
} from "./settings-layout";
import { SettingsSkeleton } from "./settings-skeleton";

const accountSchema = z.object({
  name: z.string().trim().min(1, m.validation_name_required()).max(120),
});

export function AccountSettings() {
  const account = useAccountQuery();

  if (account.status === "pending") return <SettingsSkeleton />;

  if (account.status === "error") {
    return <Error message={account.error.message} />;
  }

  return <AccountSettingsContent data={account.data} />;
}

function AccountSettingsContent({ data }: { data: AccountSettingsData }) {
  const update = useUpdateAccountMutation();
  const remove = useDeleteAccountMutation();
  const { check, isReady } = usePermissions();
  const canDeleteWorkspace = isReady && check("account.deleteWorkspace");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  const form = useForm({
    defaultValues: {
      name: data.user.name,
    },
    validators: {
      onSubmit: accountSchema,
    },
    onSubmit: async ({ value }) => {
      await update.mutateAsync(value);
    },
  });

  async function handleDelete() {
    await remove.mutateAsync();
    window.location.assign("/setup");
  }

  const canDelete = confirmEmail === data.user.email && !remove.isPending;

  const providerLabels = data.accounts
    .map((account) => providerName(account.providerId))
    .join(", ");

  return (
    <div className="grid gap-5">
      <form
        className="grid gap-0 rounded-xl border"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="name"
          children={(field) => {
            const error = field.state.meta.isTouched
              ? firstFieldError(field.state.meta.errors)
              : null;

            return (
              <SettingsRow>
                <SettingsRowContent>
                  <SettingsRowLabel>
                    {m.settings_display_name()}
                  </SettingsRowLabel>
                  <SettingsRowDescription>
                    {m.settings_display_name_description()}
                  </SettingsRowDescription>
                </SettingsRowContent>
                <SettingsRowAction>
                  <Field data-invalid={!!error}>
                    <FieldLabel htmlFor={field.name}>
                      {m.common_name()}
                    </FieldLabel>
                    <Input
                      aria-invalid={
                        field.state.meta.isTouched && !field.state.meta.isValid
                      }
                      className="w-full md:w-72"
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      value={field.state.value}
                    />
                    {error ? <FieldError>{error}</FieldError> : null}
                  </Field>
                </SettingsRowAction>
              </SettingsRow>
            );
          }}
        />
        {update.error ? (
          <p className="border-b px-4 py-3 text-sm text-destructive">
            {update.error.message}
          </p>
        ) : null}
        <div className="flex justify-end px-4 py-4">
          <Button disabled={update.isPending} type="submit">
            {update.isPending ? m.settings_saving() : m.settings_save_changes()}
          </Button>
        </div>
      </form>

      <SettingsPanel>
        <SettingsRow>
          <SettingsRowContent>
            <SettingsRowLabel>{m.common_email()}</SettingsRowLabel>
            <SettingsRowDescription>{data.user.email}</SettingsRowDescription>
          </SettingsRowContent>
        </SettingsRow>
        <SettingsRow>
          <SettingsRowContent>
            <SettingsRowLabel>{m.settings_role()}</SettingsRowLabel>
            <SettingsRowDescription>
              {data.user.role === "admin"
                ? m.auth_administrator()
                : m.settings_user()}
            </SettingsRowDescription>
          </SettingsRowContent>
        </SettingsRow>
        <SettingsRow>
          <SettingsRowContent>
            <SettingsRowLabel>{m.settings_login_method()}</SettingsRowLabel>
            <SettingsRowDescription>
              {providerLabels || m.settings_no_login_method()}
            </SettingsRowDescription>
          </SettingsRowContent>
        </SettingsRow>
        <SettingsRow>
          <SettingsRowContent>
            <SettingsRowLabel>{m.settings_active_sessions()}</SettingsRowLabel>
            <SettingsRowDescription>
              {m.settings_active_sessions_summary({
                count: data.sessions.length,
              })}
            </SettingsRowDescription>
          </SettingsRowContent>
        </SettingsRow>
        <SettingsRow>
          <SettingsRowContent>
            <SettingsRowLabel>{m.settings_created()}</SettingsRowLabel>
            <SettingsRowDescription>
              {formatDateTime(data.user.createdAt)}
            </SettingsRowDescription>
          </SettingsRowContent>
        </SettingsRow>
      </SettingsPanel>

      {canDeleteWorkspace ? (
        <SettingsPanel>
          <SettingsRow>
            <SettingsRowContent>
              <SettingsRowLabel>{m.settings_delete_account()}</SettingsRowLabel>
              <SettingsRowDescription>
                {m.settings_delete_account_panel_description()}
              </SettingsRowDescription>
              {remove.error ? (
                <p className="mt-2 text-sm text-destructive">
                  {remove.error.message}
                </p>
              ) : null}
            </SettingsRowContent>
            <SettingsRowAction>
              <Button
                onClick={() => setConfirmOpen(true)}
                type="button"
                variant="destructive"
              >
                <Trash2 className="size-4" />
                {m.settings_delete_account()}
              </Button>
            </SettingsRowAction>
          </SettingsRow>
        </SettingsPanel>
      ) : null}

      <AlertDialog
        onOpenChange={(open) => {
          setConfirmOpen(open);

          if (!open) setConfirmEmail("");
        }}
        open={confirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {m.settings_delete_account_title()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {m.settings_delete_account_description({
                email: data.user.email,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            autoComplete="off"
            onChange={(event) => setConfirmEmail(event.target.value)}
            placeholder={data.user.email}
            value={confirmEmail}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {m.common_cancel()}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!canDelete}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {remove.isPending
                ? m.settings_deleting()
                : m.settings_delete_account()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type AccountSettingsData = AccountData;

function providerName(providerId: string) {
  return providerId === "credential"
    ? m.settings_email_password()
    : providerId
      ? providerId
      : m.common_unknown();
}

function formatDateTime(value: Date | string | number | null) {
  if (!value) return m.common_unknown();
  const date = new Date(value);

  return Number.isNaN(date.valueOf())
    ? m.common_unknown()
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
