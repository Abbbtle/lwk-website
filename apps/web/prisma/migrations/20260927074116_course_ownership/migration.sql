-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "instructor_id" UUID,
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "courses_instructor_id_idx" ON "courses"("instructor_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
