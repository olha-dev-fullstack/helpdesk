import { AI_AGENT_EMAIL } from "@core";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { isPrismaError } from "../lib/prisma-errors";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

export function listUsers() {
  return prisma.user.findMany({ select: userSelect, orderBy: { createdAt: "asc" } });
}

export function findUserRole(id: string) {
  return prisma.user.findUnique({ where: { id }, select: { role: true } });
}

export function findAiAgentId() {
  return prisma.user
    .findUnique({ where: { email: AI_AGENT_EMAIL }, select: { id: true } })
    .then((user) => user?.id ?? null);
}

export function findUserIdByEmail(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true } });
}

export function findOtherUserIdByEmail(email: string, excludeId: string) {
  return prisma.user.findFirst({ where: { email, NOT: { id: excludeId } }, select: { id: true } });
}

// Creates the user and its credential account; resolves to null when the email is taken
export function createAgentWithCredential(data: {
  id: string;
  accountId: string;
  name: string;
  email: string;
  hashedPassword: string;
}) {
  const now = new Date();
  return prisma
    .$transaction([
      prisma.user.create({
        data: {
          id: data.id,
          name: data.name,
          email: data.email,
          emailVerified: false,
          role: "agent",
          createdAt: now,
          updatedAt: now,
        },
        select: userSelect,
      }),
      prisma.account.create({
        data: {
          id: data.accountId,
          accountId: data.id,
          providerId: "credential",
          userId: data.id,
          password: data.hashedPassword,
          createdAt: now,
          updatedAt: now,
        },
      }),
    ])
    .then(([user]) => user)
    .catch((err) => {
      if (isPrismaError(err, "P2002")) return null;
      throw err;
    });
}

// A set `hashedPassword` also replaces the credential and signs the user out everywhere.
// Resolves to null when the email is taken.
export function updateUser(
  id: string,
  data: { name: string; email: string; hashedPassword: string | null },
) {
  return prisma
    .$transaction(async (tx) => {
      if (data.hashedPassword) {
        await tx.account.updateMany({
          where: { userId: id, providerId: "credential" },
          data: { password: data.hashedPassword, updatedAt: new Date() },
        });
        await tx.session.deleteMany({ where: { userId: id } });
      }
      return tx.user.update({
        where: { id },
        data: { name: data.name, email: data.email, updatedAt: new Date() },
        select: userSelect,
      });
    })
    .catch((err) => {
      if (isPrismaError(err, "P2002")) return null;
      throw err;
    });
}

// Serializable so concurrent deletes can't both pass the "another admin exists" check
export function deleteUser(id: string) {
  return prisma
    .$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({ where: { id }, select: { role: true } });
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
}
