import { z } from "zod";
import { MIN_NAME_LENGTH, MIN_PASSWORD_LENGTH } from "./constants";

export const USER_ROLES = ["admin", "agent"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const nameSchema = z
  .string()
  .trim()
  .min(MIN_NAME_LENGTH, `Name must be at least ${MIN_NAME_LENGTH} characters`);
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));
const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);

export const createUserSchema = z.object(
  { name: nameSchema, email: emailSchema, password: passwordSchema },
  "name, email and password are required",
);

// An omitted/empty password leaves it unchanged
export const editUserSchema = z.object(
  {
    name: nameSchema,
    email: emailSchema,
    password: z.union([z.literal(""), passwordSchema]).optional(),
  },
  "name and email are required",
);
