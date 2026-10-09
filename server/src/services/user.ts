import crypto from "crypto";
import { hashPassword } from "better-auth/crypto";
import * as userRepository from "../repositories/user";

// Resolves to null when the email is already taken
export async function createAgent(input: { name: string; email: string; password: string }) {
  return userRepository.createAgentWithCredential({
    id: crypto.randomUUID(),
    accountId: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    hashedPassword: await hashPassword(input.password),
  });
}

// A blank password leaves the credential (and sessions) untouched; resolves to null when the email is taken
export async function updateUser(id: string, input: { name: string; email: string; password?: string | null }) {
  return userRepository.updateUser(id, {
    name: input.name,
    email: input.email,
    hashedPassword: input.password ? await hashPassword(input.password) : null,
  });
}
