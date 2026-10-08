import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const MIN_PASSWORD_LENGTH = 12; // keep in sync with server/src/lib/auth.ts

export type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "agent";
  createdAt: string;
};

const nameSchema = z.string().trim().min(3, "Name must be at least 3 characters");
const emailSchema = z.email("Enter a valid email address");
const passwordMessage = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;

const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: z.string().min(MIN_PASSWORD_LENGTH, passwordMessage),
});

// When editing, a blank password means "keep the current one"
const editUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: z
    .string()
    .refine((v) => v === "" || v.length >= MIN_PASSWORD_LENGTH, passwordMessage),
});

type UserFormValues = z.infer<typeof createUserSchema>;

export function UserFormDialog({
  user,
  open,
  onOpenChange,
}: {
  /** When set, the dialog edits this user; otherwise it creates one. */
  user?: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = !!user;
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(isEdit ? editUserSchema : createUserSchema),
    values: { name: user?.name ?? "", email: user?.email ?? "", password: "" },
  });

  const saveUser = useMutation({
    mutationFn: (values: UserFormValues) =>
      user
        ? axios.patch(`/api/users/${user.id}`, values)
        : axios.post("/api/users", values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function onSubmit(values: UserFormValues) {
    try {
      await saveUser.mutateAsync(values);
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : isEdit
            ? "Failed to update user"
            : "Failed to create user";
      setError("root", { message });
      return;
    }
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit user" : "New user"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Leave the password blank to keep it unchanged."
              : "Create an agent account. They can sign in with these credentials."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
