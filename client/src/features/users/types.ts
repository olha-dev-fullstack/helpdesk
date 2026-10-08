import type { editUserSchema, UserRole } from "@core";
import type { z } from "zod";

export type { UserRole };

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

/** Edit form shape; on create the password is required (see `createUserSchema`). */
export type UserFormValues = z.input<typeof editUserSchema>;
