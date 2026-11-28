-- AlterEnum
ALTER TYPE "patient_link_method" ADD VALUE 'self_registered';

-- AlterTable
ALTER TABLE "patients" ALTER COLUMN "created_by" DROP NOT NULL;

-- AlterTable
ALTER TABLE "practitioners" ADD COLUMN     "online_booking" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "booked_by_account_id" UUID,
ADD COLUMN     "quoted_fee" DECIMAL(12,2),
ADD COLUMN     "service_id" UUID,
ALTER COLUMN "booked_by" DROP NOT NULL;

-- AlterTable
ALTER TABLE "appointment_events" ADD COLUMN     "actor_account_id" UUID,
ALTER COLUMN "actor_user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "billing_services" ADD COLUMN     "patient_bookable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "saved_clinics" (
    "account_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_clinics_pkey" PRIMARY KEY ("account_id","branch_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "membership_id" UUID,
    "account_id" UUID,
    "kind" VARCHAR(40) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "entity_type" VARCHAR(40),
    "entity_id" UUID,
    "patient_id" UUID,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_membership_id_created_at_idx" ON "notifications"("membership_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_account_id_created_at_idx" ON "notifications"("account_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_booked_by_account_id_fkey" FOREIGN KEY ("booked_by_account_id") REFERENCES "patient_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "billing_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_actor_account_id_fkey" FOREIGN KEY ("actor_account_id") REFERENCES "patient_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_clinics" ADD CONSTRAINT "saved_clinics_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "patient_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_clinics" ADD CONSTRAINT "saved_clinics_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "patient_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every booking and every history entry has exactly one author: a staff user or a patient account.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_one_booker" CHECK (("booked_by" IS NULL) <> ("booked_by_account_id" IS NULL));
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_one_actor" CHECK (("actor_user_id" IS NULL) <> ("actor_account_id" IS NULL));
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_one_recipient" CHECK (("membership_id" IS NULL) <> ("account_id" IS NULL));
CREATE INDEX "appointments_booked_by_account_id_idx" ON "appointments" ("booked_by_account_id") WHERE "booked_by_account_id" IS NOT NULL;
