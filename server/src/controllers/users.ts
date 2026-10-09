import type { Request, Response } from "express";
import { createUserSchema, editUserSchema } from "@core";
import { parseOrReject } from "../lib/validation";
import * as userRepository from "../repositories/user";
import * as userService from "../services/user";

const EMAIL_TAKEN = "A user with this email already exists";

export async function listUsers(_req: Request, res: Response) {
  res.json({ users: await userRepository.listUsers() });
}

export async function createUser(req: Request, res: Response) {
  const input = parseOrReject(createUserSchema, req.body, res);
  if (!input) return;

  if (await userRepository.findUserIdByEmail(input.email)) {
    res.status(409).json({ error: EMAIL_TAKEN });
    return;
  }

  // The unique index is the real guard; the pre-check above only covers the common case
  const user = await userService.createAgent(input);
  if (!user) {
    res.status(409).json({ error: EMAIL_TAKEN });
    return;
  }
  res.status(201).json({ user });
}

// Name and email are required; an omitted/empty password leaves it unchanged
export async function updateUser(req: Request, res: Response) {
  const id = String(req.params.id);
  const input = parseOrReject(editUserSchema, req.body, res);
  if (!input) return;

  if (!(await userRepository.findUserRole(id))) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (await userRepository.findOtherUserIdByEmail(input.email, id)) {
    res.status(409).json({ error: EMAIL_TAKEN });
    return;
  }

  const user = await userService.updateUser(id, input);
  if (!user) {
    res.status(409).json({ error: EMAIL_TAKEN });
    return;
  }
  res.json({ user });
}

export async function deleteUser(req: Request, res: Response) {
  const id = String(req.params.id);
  if (id === req.user?.id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  const result = await userRepository.deleteUser(id);
  if (result === "not-found") {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (result === "last-admin") {
    res.status(409).json({ error: "You cannot delete the last admin" });
    return;
  }
  if (result === "conflict") {
    res.status(409).json({ error: "Conflicting change, please try again" });
    return;
  }
  res.status(204).end();
}
