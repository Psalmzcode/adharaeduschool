-- AlterTable
ALTER TABLE "typing_attempts" ADD COLUMN IF NOT EXISTS "errorProfile" JSONB;
