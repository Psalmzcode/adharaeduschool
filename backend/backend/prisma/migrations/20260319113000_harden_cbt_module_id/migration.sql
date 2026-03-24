-- Backfill legacy CBT exams that do not have a valid moduleId.
-- Prefer a module from the same track; fallback to the first module.
WITH cbt_targets AS (
  SELECT
    c.id AS cbt_id,
    COALESCE(
      (
        SELECT m.id
        FROM "modules" m
        WHERE m."track" = c."track"
        ORDER BY m."number" ASC
        LIMIT 1
      ),
      (
        SELECT m2.id
        FROM "modules" m2
        ORDER BY m2."track" ASC, m2."number" ASC
        LIMIT 1
      )
    ) AS resolved_module_id
  FROM "cbt_exams" c
  WHERE c."moduleId" IS NULL
     OR btrim(c."moduleId") = ''
     OR NOT EXISTS (
       SELECT 1
       FROM "modules" m
       WHERE m.id = c."moduleId"
     )
)
UPDATE "cbt_exams" c
SET "moduleId" = t.resolved_module_id
FROM cbt_targets t
WHERE c.id = t.cbt_id
  AND t.resolved_module_id IS NOT NULL;

-- Normalize CBT titles to module-based naming for consistency.
UPDATE "cbt_exams" c
SET "title" = CONCAT('Module ', m."number", ': ', m."title", ' Assessment')
FROM "modules" m
WHERE c."moduleId" = m.id;

-- Enforce integrity at database level.
ALTER TABLE "cbt_exams"
ALTER COLUMN "moduleId" SET NOT NULL;

ALTER TABLE "cbt_exams"
ADD CONSTRAINT "cbt_exams_moduleId_fkey"
FOREIGN KEY ("moduleId") REFERENCES "modules"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
