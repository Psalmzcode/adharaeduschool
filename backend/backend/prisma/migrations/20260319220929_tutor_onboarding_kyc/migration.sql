-- CreateEnum
CREATE TYPE "TutorOnboardingStatus" AS ENUM ('DRAFT', 'COMPLETE');

-- CreateEnum
CREATE TYPE "TutorIdentificationType" AS ENUM ('NIN', 'VOTERS_CARD', 'DRIVERS_LICENSE', 'INTERNATIONAL_PASSPORT');

-- AlterTable
ALTER TABLE "tutors" ADD COLUMN     "guarantors" JSONB,
ADD COLUMN     "identificationDocumentUrl" TEXT,
ADD COLUMN     "identificationNumber" TEXT,
ADD COLUMN     "identificationType" "TutorIdentificationType",
ADD COLUMN     "onboardingStatus" "TutorOnboardingStatus" NOT NULL DEFAULT 'COMPLETE',
ADD COLUMN     "passportPhotoUrl" TEXT,
ADD COLUMN     "signatureUrl" TEXT;
