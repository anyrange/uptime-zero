import { useForm } from "@tanstack/react-form";

import type { SettingsOverview } from "@/lib/api/settings";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import { useUpdateRetentionMutation } from "@/lib/api/settings";
import { firstFieldError } from "@/lib/form-errors";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { RetentionSettings as RetentionSettingsInput } from "@/lib/schemas/settings";
import { m } from "@/paraglide/messages.js";

import {
  SettingsRow,
  SettingsRowAction,
  SettingsRowContent,
  SettingsRowDescription,
  SettingsRowLabel,
} from "./settings-layout";

export function RetentionSettings({ data }: { data: SettingsOverview }) {
  const update = useUpdateRetentionMutation();
  const { check, isReady } = usePermissions();
  const canUpdateRetention = isReady && check("settings.updateRetention");

  const form = useForm({
    defaultValues: {
      heartbeatRetentionDays: data.settings.heartbeatRetentionDays,
      incidentRetentionDays: data.settings.incidentRetentionDays,
    },
    validators: {
      onSubmit: RetentionSettingsInput,
    },
    onSubmit: async ({ value }) => {
      await update.mutateAsync(value);
    },
  });

  return (
    <form
      className="grid gap-0 rounded-xl border"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="heartbeatRetentionDays"
        children={(field) => {
          const error = field.state.meta.isTouched
            ? firstFieldError(field.state.meta.errors)
            : null;

          return (
            <SettingsRow>
              <SettingsRowContent>
                <SettingsRowLabel>
                  {m.settings_heartbeat_retention()}
                </SettingsRowLabel>
                <SettingsRowDescription>
                  {m.settings_heartbeat_retention_description()}
                </SettingsRowDescription>
              </SettingsRowContent>
              <SettingsRowAction>
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor={field.name}>
                    {m.settings_days()}
                  </FieldLabel>
                  <NumberField
                    aria-invalid={
                      field.state.meta.isTouched && !field.state.meta.isValid
                    }
                    className="w-32"
                    id={field.name}
                    min={1}
                    name={field.name}
                    onValueChange={(value) => field.handleChange(value ?? 0)}
                    value={field.state.value}
                  >
                    <NumberFieldGroup>
                      <NumberFieldDecrement />
                      <NumberFieldInput onBlur={field.handleBlur} />
                      <NumberFieldIncrement />
                    </NumberFieldGroup>
                  </NumberField>
                  {error ? <FieldError>{error}</FieldError> : null}
                </Field>
              </SettingsRowAction>
            </SettingsRow>
          );
        }}
      />
      <form.Field
        name="incidentRetentionDays"
        children={(field) => {
          const error = field.state.meta.isTouched
            ? firstFieldError(field.state.meta.errors)
            : null;

          return (
            <SettingsRow>
              <SettingsRowContent>
                <SettingsRowLabel>
                  {m.settings_closed_incident_retention()}
                </SettingsRowLabel>
                <SettingsRowDescription>
                  {m.settings_incident_retention_description()}
                </SettingsRowDescription>
              </SettingsRowContent>
              <SettingsRowAction>
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor={field.name}>
                    {m.settings_days()}
                  </FieldLabel>
                  <NumberField
                    aria-invalid={
                      field.state.meta.isTouched && !field.state.meta.isValid
                    }
                    className="w-32"
                    id={field.name}
                    min={1}
                    name={field.name}
                    onValueChange={(value) => field.handleChange(value ?? 0)}
                    value={field.state.value}
                  >
                    <NumberFieldGroup>
                      <NumberFieldDecrement />
                      <NumberFieldInput onBlur={field.handleBlur} />
                      <NumberFieldIncrement />
                    </NumberFieldGroup>
                  </NumberField>
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
        <Button
          disabled={update.isPending || !canUpdateRetention}
          type="submit"
        >
          {m.settings_save_changes()}
        </Button>
      </div>
    </form>
  );
}
