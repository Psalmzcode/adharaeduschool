-- Enum value `SCHOOL_REGISTRATION` is added in 20260417000000_otp_school_registration.
-- This migration only renames the index (long name truncation fix).

-- RenameIndex
ALTER INDEX "class_curriculum_state_schoolId_className_curriculumBranchKey_k" RENAME TO "class_curriculum_state_schoolId_className_curriculumBranchK_key";
