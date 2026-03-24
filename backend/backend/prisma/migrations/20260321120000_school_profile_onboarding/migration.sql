-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('NURSERY_PRIMARY', 'PRIMARY', 'SECONDARY', 'MIXED', 'OTHER');

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "officialName" TEXT,
ADD COLUMN     "schoolType" "SchoolType",
ADD COLUMN     "website" TEXT,
ADD COLUMN     "officialEmail" TEXT,
ADD COLUMN     "officialPhone" TEXT,
ADD COLUMN     "ictContactName" TEXT,
ADD COLUMN     "ictContactPhone" TEXT,
ADD COLUMN     "ictContactEmail" TEXT,
ADD COLUMN     "billingContactName" TEXT,
ADD COLUMN     "billingContactEmail" TEXT,
ADD COLUMN     "billingContactPhone" TEXT,
ADD COLUMN     "platformLevels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "currentTermLabel" TEXT,
ADD COLUMN     "academicYearLabel" TEXT,
ADD COLUMN     "studentCountBand" TEXT,
ADD COLUMN     "streamsCount" INTEGER,
ADD COLUMN     "visitDeploymentNotes" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en-NG',
ADD COLUMN     "profileCompletedAt" TIMESTAMP(3);
