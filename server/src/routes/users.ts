import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { hashPassword } from "better-auth/crypto";
import crypto from "crypto";
import { MIN_PASSWORD_LENGTH } from "../lib/auth";
import { prisma } from "../lib/prisma";

export const usersRouter = Router();

const MIN_NAME_LENGTH = 3;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

function isPrismaError(err: unknown, code: string) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

const EMAIL_TAKEN = "A user with this email already exists";

function validateName(name: string) {
  return name.trim().length >= MIN_NAME_LENGTH
    ? null
    : `Name must be at least ${MIN_NAME_LENGTH} characters`;
}

function validateEmail(email: string) {
  return EMAIL_PATTERN.test(email.trim().toLowerCase())
    ? null
    : "Enter a valid email address";
}

function validatePassword(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH
    ? null
    : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
}

usersRouter.post("/", async (req, res) => {
  const { name, email, password } = req.body ?? {};

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    res.status(400).json({ error: "name, email and password are required" });
    return;
  }

  const error = validateName(name) ?? validateEmail(email) ?? validatePassword(password);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

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
  const { name, email, password } = req.body ?? {};

  if (typeof name !== "string" || typeof email !== "string") {
    res.status(400).json({ error: "name and email are required" });
    return;
  }
  if (password !== undefined && typeof password !== "string") {
    res.status(400).json({ error: "password must be a string" });
    return;
  }

  const changePassword = typeof password === "string" && password !== "";
  const error =
    validateName(name) ??
    validateEmail(email) ??
    (changePassword ? validatePassword(password) : null);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const taken = await prisma.user.findFirst({
    where: { email: normalizedEmail, NOT: { id } },
    select: { id: true },
  });
  if (taken) {
    res.status(409).json({ error: EMAIL_TAKEN });
    return;
  }

  const hashedPassword = changePassword ? await hashPassword(password) : null;

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
        data: { name: name.trim(), email: normalizedEmail, updatedAt: new Date() },
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
