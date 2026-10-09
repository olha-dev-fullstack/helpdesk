import "dotenv/config";
import { AI_AGENT_EMAIL, AI_AGENT_NAME } from "@core";
import { PrismaPg } from "@prisma/adapter-pg";
import crypto from "crypto";
import { PrismaClient, Role } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// No credential account is created, so nobody can sign in as the AI agent
async function main() {
  const existing = await prisma.user.findUnique({ where: { email: AI_AGENT_EMAIL } });
  if (existing) {
    console.log(`AI agent ${AI_AGENT_EMAIL} already exists — skipping.`);
    return;
  }

  const now = new Date();
  await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      name: AI_AGENT_NAME,
      email: AI_AGENT_EMAIL,
      emailVerified: false,
      role: Role.agent,
      createdAt: now,
      updatedAt: now,
    },
  });
  console.log(`AI agent ${AI_AGENT_EMAIL} created successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
