-- CreateEnum
CREATE TYPE "AcademicAuditAction" AS ENUM ('MODULE_ADVANCE', 'MODULE_RETAKE', 'MODULE_SCORE_UPDATE', 'PRACTICAL_GRADE', 'ASSIGNMENT_GRADE', 'BULK_CERT_ISSUE', 'CERT_ISSUE', 'CERT_REVOKE');

-- CreateEnum
CREATE TYPE "TutorAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE');

-- CreateTable
CREATE TABLE "academic_audit_logs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "action" "AcademicAuditAction" NOT NULL,
    "className" TEXT,
    "studentId" TEXT,
    "moduleId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_attendance_logs" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "TutorAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "markedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_attendance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_audit_logs_schoolId_createdAt_idx" ON "academic_audit_logs"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "academic_audit_logs_actorUserId_createdAt_idx" ON "academic_audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "tutor_attendance_logs_schoolId_date_idx" ON "tutor_attendance_logs"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_attendance_logs_tutorId_schoolId_date_key" ON "tutor_attendance_logs"("tutorId", "schoolId", "date");

-- AddForeignKey
ALTER TABLE "academic_audit_logs" ADD CONSTRAINT "academic_audit_logs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_attendance_logs" ADD CONSTRAINT "tutor_attendance_logs_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_attendance_logs" ADD CONSTRAINT "tutor_attendance_logs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
