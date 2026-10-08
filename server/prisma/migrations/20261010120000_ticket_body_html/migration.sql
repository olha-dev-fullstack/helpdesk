-- AlterTable
ALTER TABLE "ticket" RENAME COLUMN "body" TO "bodyHtml";

-- AlterTable
ALTER TABLE "reply" ADD COLUMN "bodyHtml" TEXT;
