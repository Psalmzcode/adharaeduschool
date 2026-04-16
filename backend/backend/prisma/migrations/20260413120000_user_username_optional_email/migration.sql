-- AlterTable: optional email + unique username for login
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");

ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
