import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { UserFormValues } from "../types";

export function UserFormFields({
  register,
  errors,
  isEdit,
  isSubmitting,
}: {
  register: UseFormRegister<UserFormValues>;
  errors: FieldErrors<UserFormValues>;
  isEdit: boolean;
  isSubmitting: boolean;
}) {
  return (
    <FieldGroup>
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="new-user-name">Name</FieldLabel>
        <Input
          id="new-user-name"
          autoComplete="off"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor="new-user-email">Email</FieldLabel>
        <Input
          id="new-user-email"
          type="email"
          autoComplete="off"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        <FieldError errors={[errors.email]} />
      </Field>
      <Field data-invalid={!!errors.password}>
        <FieldLabel htmlFor="new-user-password">Password</FieldLabel>
        <Input
          id="new-user-password"
          type="password"
          autoComplete="new-password"
          placeholder={isEdit ? "Unchanged" : undefined}
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        <FieldError errors={[errors.password]} />
      </Field>
      <FieldError errors={[errors.root]} />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? isEdit
            ? "Saving..."
            : "Creating..."
          : isEdit
            ? "Save changes"
            : "Create user"}
      </Button>
    </FieldGroup>
  );
}
