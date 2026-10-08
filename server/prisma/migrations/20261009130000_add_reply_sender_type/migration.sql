-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('agent', 'customer');

-- AlterTable
ALTER TABLE "reply" ADD COLUMN "senderType" "SenderType" NOT NULL DEFAULT 'agent';
