import type { ReactNode } from "react";

import { useForm } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useHydrated } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  sessionQueryOptions,
  setupStateQueryOptions,
  useLoginMutation,
} from "@/lib/api/auth";
import { firstFieldError } from "@/lib/form-errors";
import { SignInInput } from "@/lib/schemas/auth";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const [setup, session] = await Promise.all([
      queryClient.ensureQueryData(setupStateQueryOptions()),
      queryClient.ensureQueryData(sessionQueryOptions()),
    ]);

    if (!setup.hasAdmin) {
      throw redirect({ to: "/setup" });
    }

    if (session.user) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginRoute,
});

function LoginRoute() {
  const { data: setup } = useSuspenseQuery(setupStateQueryOptions());
  const navigate = Route.useNavigate();
  // Before hydration the form would submit natively, putting the password
  // in the URL, so it only becomes submittable once React owns it.
  const hydrated = useHydrated();
  const mutation = useLoginMutation();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: SignInInput,
    },
    // Failures render from `mutation.error` below the fields.
    onSubmit: ({ value }) =>
      mutation.mutate(value, { onSuccess: () => navigate({ to: "/" }) }),
  });

  return (
    <AuthFrame>
      <AuthFrameHeader>
        <AuthFrameEyebrow>{setup.appName}</AuthFrameEyebrow>
        <AuthFrameTitle>{m.auth_sign_in()}</AuthFrameTitle>
      </AuthFrameHeader>
      <AuthFrameBody>
        <AuthCard>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <form.Field
              name="email"
              children={(field) => (
                <Field
                  data-invalid={
                    field.state.meta.isTouched && !field.state.meta.isValid
                  }
                >
                  <FieldLabel htmlFor={field.name}>
                    {m.common_email()}
                  </FieldLabel>
                  <Input
                    aria-invalid={
                      field.state.meta.isTouched && !field.state.meta.isValid
                    }
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    type="email"
                    value={field.state.value}
                  />
                  {field.state.meta.isTouched ? (
                    <FieldError>
                      {firstFieldError(field.state.meta.errors)}
                    </FieldError>
                  ) : null}
                </Field>
              )}
            />
            <form.Field
              name="password"
              children={(field) => (
                <Field
                  data-invalid={
                    field.state.meta.isTouched && !field.state.meta.isValid
                  }
                >
                  <FieldLabel htmlFor={field.name}>
                    {m.common_password()}
                  </FieldLabel>
                  <Input
                    aria-invalid={
                      field.state.meta.isTouched && !field.state.meta.isValid
                    }
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    type="password"
                    value={field.state.value}
                  />
                  {field.state.meta.isTouched ? (
                    <FieldError>
                      {firstFieldError(field.state.meta.errors)}
                    </FieldError>
                  ) : null}
                </Field>
              )}
            />
            {mutation.error ? (
              <p className="text-sm text-destructive">
                {mutation.error.message}
              </p>
            ) : null}
            <Button disabled={!hydrated || mutation.isPending} type="submit">
              {m.auth_sign_in()}
            </Button>
          </form>
        </AuthCard>
      </AuthFrameBody>
    </AuthFrame>
  );
}

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

function AuthFrameHeader({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

function AuthFrameEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function AuthFrameTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="mt-2 text-3xl font-semibold tracking-tight">{children}</h1>
  );
}

function AuthFrameBody({ children }: { children: ReactNode }) {
  return <div className="mt-6">{children}</div>;
}

function AuthCard({ children }: { children: ReactNode }) {
  return <Card className="px-6 py-6">{children}</Card>;
}
