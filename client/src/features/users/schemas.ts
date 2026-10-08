import { z } from "zod";
import { MIN_NAME_LENGTH, MIN_PASSWORD_LENGTH } from "./constants";

const nameSchema = z
  .string()
  .trim()
  .min(MIN_NAME_LENGTH, `Name must be at least ${MIN_NAME_LENGTH} characters`);
const emailSchema = z.email("Enter a valid email address");
const passwordMessage = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;

export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: z.string().min(MIN_PASSWORD_LENGTH, passwordMessage),
});

// When editing, a blank password means "keep the current one"
export const editUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: z
    .string()
    .refine((v) => v === "" || v.length >= MIN_PASSWORD_LENGTH, passwordMessage),
});
