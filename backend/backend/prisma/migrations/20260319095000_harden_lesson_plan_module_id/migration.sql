-- Backfill legacy lesson plans that do not have a valid moduleId
-- before making moduleId required at the database level.
WITH default_module AS (
  SELECT id
  FROM "modules"
  ORDER BY "track" ASC, "number" ASC
  LIMIT 1
)
UPDATE "lesson_plans" lp
SET "moduleId" = dm.id
FROM default_module dm
WHERE lp."moduleId" IS NULL
   OR btrim(lp."moduleId") = ''
   OR NOT EXISTS (
     SELECT 1
     FROM "modules" m
     WHERE m.id = lp."moduleId"
   );

-- Align persisted lesson titles with module identity to prevent drift.
UPDATE "lesson_plans" lp
SET "title" = CONCAT('Module ', m."number", ': ', m."title")
FROM "modules" m
WHERE lp."moduleId" = m.id;

-- Enforce integrity at schema level.
ALTER TABLE "lesson_plans"
ALTER COLUMN "moduleId" SET NOT NULL;

ALTER TABLE "lesson_plans"
ADD CONSTRAINT "lesson_plans_moduleId_fkey"
FOREIGN KEY ("moduleId") REFERENCES "modules"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
