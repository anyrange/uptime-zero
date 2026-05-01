import type { ReactNode } from "react";

import { useForm } from "@tanstack/react-form";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { z } from "zod";

import { Error as AppError } from "@/components/error";
import { Loading } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  useLoginMutation,
  useSessionQuery,
  useSetupStateQuery,
} from "@/lib/queries/auth";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/login")({
  component: LoginRoute,
});

const loginSchema = z.object({
  email: z.email(m.validation_email_valid()),
  password: z.string().min(1, m.validation_password_required()),
});

function LoginRoute() {
  const setup = useSetupStateQuery();
  const session = useSessionQuery();
  const mutation = useLoginMutation();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  if (setup.status === "pending" || session.status === "pending") {
    return (
      <AuthFrame>
        <Loading />
      </AuthFrame>
    );
  }

  if (setup.status === "error") {
    return (
      <AuthFrame>
        <AppError message={setup.error.message} />
      </AuthFrame>
    );
  }

  if (session.status === "error") {
    return (
      <AuthFrame>
        <AppError message={session.error.message} />
      </AuthFrame>
    );
  }

  if (!setup.data.hasAdmin) {
    return <Navigate to="/setup" />;
  }

  if (session.data.user) {
    return <Navigate to="/" />;
  }

  return (
    <AuthFrame>
      <AuthFrameHeader>
        <AuthFrameEyebrow>{setup.data.appName}</AuthFrameEyebrow>
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
            <Button disabled={mutation.isPending} type="submit">
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

function firstFieldError(errors: unknown[]) {
  const first = errors[0];
  return typeof first === "string"
    ? first
    : first instanceof Error
      ? first.message
      : null;
}
