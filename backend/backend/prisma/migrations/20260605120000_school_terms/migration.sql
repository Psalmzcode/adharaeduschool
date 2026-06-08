-- CreateEnum
CREATE TYPE "SchoolTermStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "school_terms" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearLabel" TEXT NOT NULL,
    "termOrdinal" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" "SchoolTermStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_terms_schoolId_label_key" ON "school_terms"("schoolId", "label");

-- CreateIndex
CREATE INDEX "school_terms_schoolId_status_idx" ON "school_terms"("schoolId", "status");

-- AddForeignKey
ALTER TABLE "school_terms" ADD CONSTRAINT "school_terms_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill active term rows from existing school labels
INSERT INTO "school_terms" ("id", "schoolId", "academicYearLabel", "termOrdinal", "label", "status", "startedAt", "createdAt")
SELECT
  md5(s.id || ':' || COALESCE(s."currentTermLabel", s."academicYearLabel" || ' Term 2')) || substr(md5(random()::text), 1, 8),
  s.id,
  COALESCE(NULLIF(trim(s."academicYearLabel"), ''), '2025/2026'),
  CASE
    WHEN COALESCE(s."currentTermLabel", '') ILIKE '%term 1%' THEN 1
    WHEN COALESCE(s."currentTermLabel", '') ILIKE '%term 3%' THEN 3
    ELSE 2
  END,
  COALESCE(NULLIF(trim(s."currentTermLabel"), ''), COALESCE(NULLIF(trim(s."academicYearLabel"), ''), '2025/2026') || ' Term 2'),
  'ACTIVE'::"SchoolTermStatus",
  COALESCE(s."createdAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "schools" s
WHERE COALESCE(NULLIF(trim(s."currentTermLabel"), ''), NULLIF(trim(s."academicYearLabel"), '')) IS NOT NULL
ON CONFLICT ("schoolId", "label") DO NOTHING;
