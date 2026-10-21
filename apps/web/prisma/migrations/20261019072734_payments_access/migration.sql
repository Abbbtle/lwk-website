-- Course access grants and memberships (Phase 14a). Orders and payment events arrive with checkout
-- (Phase 14b).

-- CreateEnum
CREATE TYPE "AccessSource" AS ENUM ('PURCHASE', 'GIFT', 'ADMIN');

-- CreateEnum
CREATE TYPE "MembershipPlan" AS ENUM ('MONTHLY', 'YEARLY', 'FOUNDING_YEARLY', 'FAMILY_YEARLY', 'COMMUNITY_YEARLY');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'EXPIRED');

-- CreateTable
CREATE TABLE "course_access" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "source" "AccessSource" NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "payer_id" UUID NOT NULL,
    "plan" "MembershipPlan" NOT NULL,
    "region" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount_minor_units" INTEGER NOT NULL,
    "status" "MembershipStatus" NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "provider_customer_code" TEXT,
    "provider_subscription_code" TEXT,
    "provider_email_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_seats" (
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "user_id" UUID,
    "invited_email" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_seats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_access_course_id_idx" ON "course_access"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_access_user_id_course_id_source_key" ON "course_access"("user_id", "course_id", "source");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_provider_subscription_code_key" ON "memberships"("provider_subscription_code");

-- CreateIndex
CREATE INDEX "memberships_payer_id_idx" ON "memberships"("payer_id");

-- CreateIndex
CREATE INDEX "membership_seats_user_id_idx" ON "membership_seats"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_seats_membership_id_user_id_key" ON "membership_seats"("membership_id", "user_id");

-- AddForeignKey
ALTER TABLE "course_access" ADD CONSTRAINT "course_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_access" ADD CONSTRAINT "course_access_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_seats" ADD CONSTRAINT "membership_seats_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_seats" ADD CONSTRAINT "membership_seats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A membership's price is whole minor units, never negative, in one of the price list's regions
-- and currencies (src/lib/pricing, read and written through chargedPrice).
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_amount_minor_units_check" CHECK ("amount_minor_units" >= 0);
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_region_check" CHECK ("region" IN ('south-africa', 'high-income', 'india', 'rest-of-world'));
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_currency_check" CHECK ("currency" IN ('ZAR', 'USD', 'INR'));

-- A trial has an end date.
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_trial_ends_at_check" CHECK ("status" <> 'TRIALING' OR "trial_ends_at" IS NOT NULL);

-- A seat has a user exactly when its invitation has been accepted.
ALTER TABLE "membership_seats" ADD CONSTRAINT "membership_seats_accepted_check" CHECK (("user_id" IS NULL) = ("accepted_at" IS NULL));
