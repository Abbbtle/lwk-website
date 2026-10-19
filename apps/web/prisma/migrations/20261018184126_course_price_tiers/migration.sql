-- Courses are priced in five tiers, each with a price per region (src/lib/pricing).
-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "price_tier" SMALLINT;

ALTER TABLE "courses" ADD CONSTRAINT "courses_price_tier_check" CHECK ("price_tier" BETWEEN 1 AND 5);

-- Old USD prices become the nearest tier for high-income countries ($12.99, $19.99, $29.99, $49.99,
-- $79.99). Free courses have no tier. "price_cents" and "currency" stay for now: the previous
-- release still reads them while this one deploys, and after a rollback.
UPDATE "courses"
SET "price_tier" = CASE
    WHEN "price_cents" <= 1649 THEN 1
    WHEN "price_cents" <= 2499 THEN 2
    WHEN "price_cents" <= 3999 THEN 3
    WHEN "price_cents" <= 6499 THEN 4
    ELSE 5
  END
WHERE "price_cents" IS NOT NULL AND NOT "is_free";
