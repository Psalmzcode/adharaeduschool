-- Track 3 curriculum branches (Python/Flask vs React/Node) + tutor/student stack fields

CREATE TYPE "ModuleStackVariant" AS ENUM ('COMMON', 'PYTHON_FLASK', 'REACT_NODE');
CREATE TYPE "Track3Stack" AS ENUM ('PYTHON_FLASK', 'REACT_NODE');

ALTER TABLE "modules" ADD COLUMN "stackVariant" "ModuleStackVariant" NOT NULL DEFAULT 'COMMON';

DROP INDEX IF EXISTS "modules_track_number_key";

CREATE UNIQUE INDEX "modules_track_number_stackVariant_key" ON "modules"("track", "number", "stackVariant");

ALTER TABLE "students" ADD COLUMN "track3Stack" "Track3Stack";

ALTER TABLE "tutor_assignments" ADD COLUMN "track3Stack" "Track3Stack";

-- Existing Track 3 branching modules (3 & 4) follow the Python/Flask handbook path by default
UPDATE "modules" SET "stackVariant" = 'PYTHON_FLASK' WHERE "track" = 'TRACK_3' AND "number" IN (3, 4);
