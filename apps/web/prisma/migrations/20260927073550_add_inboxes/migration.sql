-- CreateEnum
CREATE TYPE "InquiryType" AS ENUM ('GENERAL', 'SUPPORT', 'PARTNERSHIP', 'FEEDBACK', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "inquiry_type" "InquiryType" NOT NULL,
    "message" TEXT NOT NULL,
    "handled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_applications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "initiated_name" TEXT,
    "email" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "linked_in" TEXT,
    "website" TEXT,
    "expertise" TEXT NOT NULL,
    "experience_years" INTEGER NOT NULL,
    "degree" TEXT NOT NULL,
    "certifications" TEXT,
    "work_experience" TEXT NOT NULL,
    "teaching_experience" TEXT NOT NULL,
    "languages" TEXT NOT NULL,
    "motivation" TEXT NOT NULL,
    "philosophy" TEXT NOT NULL,
    "strengths" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "review_note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructor_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_messages_handled_at_created_at_idx" ON "contact_messages"("handled_at", "created_at");

-- CreateIndex
CREATE INDEX "instructor_applications_status_created_at_idx" ON "instructor_applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "instructor_applications_user_id_idx" ON "instructor_applications"("user_id");

-- AddForeignKey
ALTER TABLE "instructor_applications" ADD CONSTRAINT "instructor_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_applications" ADD CONSTRAINT "instructor_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
