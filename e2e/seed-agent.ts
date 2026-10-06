// Creates the e2e agent user (same hashing/shape as server/prisma/seed.ts). Idempotent.
// Imports use server paths because bare specifiers resolve relative to this file.
import crypto from "node:crypto";
import { PrismaPg } from "../server/node_modules/@prisma/adapter-pg";
import { PrismaClient, Role } from "../server/src/generated/prisma/client";
import { hashPassword } from "../server/node_modules/better-auth/dist/crypto/index.mjs";

const url = process.env.DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) {
  throw new Error("Refusing to seed agent into a non-test database");
}
const email = process.env.E2E_AGENT_EMAIL!;
const password = process.env.E2E_AGENT_PASSWORD!;
const name = process.env.E2E_AGENT_NAME!;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

try {
  if (!(await prisma.user.findUnique({ where: { email } }))) {
    const id = crypto.randomUUID();
    const now = new Date();
    await prisma.$transaction([
      prisma.user.create({
        data: { id, name, email, emailVerified: false, role: Role.agent, createdAt: now, updatedAt: now },
      }),
      prisma.account.create({
        data: {
          id: crypto.randomUUID(),
          accountId: id,
          providerId: "credential",
          userId: id,
          password: await hashPassword(password),
          createdAt: now,
          updatedAt: now,
        },
      }),
    ]);
  }
} finally {
  await prisma.$disconnect();
}
