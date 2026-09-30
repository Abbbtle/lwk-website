-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('VIDEO', 'AUDIO', 'ARTICLE', 'PDF');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "is_free" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_sample" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "media_key" TEXT,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "cover_key" TEXT,
    "category_id" UUID,
    "author_name" TEXT NOT NULL,
    "created_by_id" UUID,
    "status" "ResourceStatus" NOT NULL DEFAULT 'DRAFT',
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resources_slug_key" ON "resources"("slug");

-- CreateIndex
CREATE INDEX "resources_status_published_at_idx" ON "resources"("status", "published_at");

-- CreateIndex
CREATE INDEX "resources_category_id_idx" ON "resources"("category_id");

-- CreateIndex
CREATE INDEX "courses_is_free_status_idx" ON "courses"("is_free", "status");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
