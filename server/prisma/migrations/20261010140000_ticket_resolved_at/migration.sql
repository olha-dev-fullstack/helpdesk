-- AlterTable
ALTER TABLE "ticket" ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- Backfill: the last update is the best available estimate for tickets already resolved or closed
UPDATE "ticket" SET "resolvedAt" = "updatedAt" WHERE "status" IN ('resolved', 'closed');
