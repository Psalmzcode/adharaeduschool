-- Term exam scope: modules covered in the assessment period
ALTER TABLE "cbt_exams" ADD COLUMN IF NOT EXISTS "coveredModuleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
