-- AlterTable (separate migration: a new enum value can't be used in the transaction that adds it)
ALTER TABLE "ticket" ALTER COLUMN "status" SET DEFAULT 'new';
