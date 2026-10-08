import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { hashPassword } from "better-auth/crypto";
import crypto from "crypto";
import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { isPrismaError } from "../lib/prisma-errors";
import { parseOrReject } from "../lib/validation";

export const usersRouter = Router();

const MIN_NAME_LENGTH = 3;
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { createdAt: "asc" },
  });
  res.json({ users });
});

const EMAIL_TAKEN = "A user with this email already exists";

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

const createUserSchema = z.object(
  { name: nameSchema, email: emailSchema, password: passwordSchema },
  "name, email and password are required",
);

// An omitted/empty password leaves it unchanged
const updateUserSchema = z.object(
  {
    name: nameSchema,
    email: emailSchema,
    password: z.union([z.literal(""), passwordSchema]).optional(),
  },
  "name and email are required",
);

usersRouter.post("/", async (req, res) => {
  const input = parseOrReject(createUserSchema, req.body, res);
  if (!input) return;
  const { name: trimmedName, email: normalizedEmail, password } = input;

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existing) {
    res.status(409).json({ error: EMAIL_TAKEN });
    return;
  }

  const hashedPassword = await hashPassword(password);
  const userId = crypto.randomUUID();
  const now = new Date();

  // The unique index is the real guard; the pre-check above only covers the common case
  const created = await prisma
    .$transaction([
    prisma.user.create({
      data: {
        id: userId,
        name: trimmedName,
        email: normalizedEmail,
        emailVerified: false,
        role: "agent",
        createdAt: now,
        updatedAt: now,
      },
      select: userSelect,
    }),
    prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    }),
  ])
    .catch((err) => {
      if (isPrismaError(err, "P2002")) return null;
      throw err;
    });
  if (!created) {
    res.status(409).json({ error: EMAIL_TAKEN });
    return;
  }
  const [user] = created;

  res.status(201).json({ user });
});

// Name and email are required; an omitted/empty password leaves it unchanged
usersRouter.patch("/:id", async (req, res) => {
  const id = String(req.params.id);
  const input = parseOrReject(updateUserSchema, req.body, res);
  if (!input) return;
  const { name, email: normalizedEmail, password } = input;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const taken = await prisma.user.findFirst({
    where: { email: normalizedEmail, NOT: { id } },
    select: { id: true },
  });
  if (taken) {
    res.status(409).json({ error: EMAIL_TAKEN });
    return;
  }

  const hashedPassword = password ? await hashPassword(password) : null;

  const user = await prisma
    .$transaction(async (tx) => {
      if (hashedPassword) {
        await tx.account.updateMany({
          where: { userId: id, providerId: "credential" },
          data: { password: hashedPassword, updatedAt: new Date() },
        });
        // Force re-login everywhere after a password change
        await tx.session.deleteMany({ where: { userId: id } });
      }
      return tx.user.update({
        where: { id },
        data: { name, email: normalizedEmail, updatedAt: new Date() },
        select: userSelect,
      });
    })
    .catch((err) => {
      if (isPrismaError(err, "P2002")) return null;
      throw err;
    });
  if (!user) {
    res.status(409).json({ error: EMAIL_TAKEN });
    return;
  }

  res.json({ user });
});

usersRouter.delete("/:id", async (req, res) => {
  const id = String(req.params.id);

  if (id === req.user?.id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  // Serializable so concurrent deletes can't both pass the "another admin exists" check
  const result = await prisma
    .$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id },
          select: { role: true },
        });
        if (!target) return "not-found" as const;
        if (target.role === "admin") {
          const admins = await tx.user.count({ where: { role: "admin" } });
          if (admins <= 1) return "last-admin" as const;
        }
        // Sessions and accounts are removed by onDelete: Cascade
        await tx.user.delete({ where: { id } });
        return "deleted" as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    .catch((err) => {
      if (isPrismaError(err, "P2034")) return "conflict" as const;
      throw err;
    });

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
});
