import { z } from "zod";

import { m } from "@/paraglide/messages.js";

export const Role = z.enum(["admin", "user"]);

export type Role = z.infer<typeof Role>;

/** The signed-in user as every layer sees it. */
export type SessionUser = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly image: string | null;
  readonly role: Role;
};

export type Session = { readonly user: SessionUser | null };

const Email = z
  .string()
  .trim()
  .email({ error: () => m.validation_email_valid() });

export const MIN_PASSWORD_LENGTH = 12;

export const SignInInput = z.object({
  email: Email,
  password: z
    .string()
    .min(1, { error: () => m.validation_password_required() }),
});

/** The first and only account; it becomes the installation's admin. */
export const SetupInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: () => m.validation_name_required() }),
  email: Email,
  password: z.string().min(MIN_PASSWORD_LENGTH, {
    error: () => m.validation_password_min_12(),
  }),
});
