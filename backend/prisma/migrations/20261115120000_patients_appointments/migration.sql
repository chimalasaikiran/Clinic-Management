-- CreateEnum
CREATE TYPE "patient_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "practitioner_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('pending', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "appointment_type" AS ENUM ('consultation', 'follow_up', 'procedure', 'diagnostic_review');

-- CreateEnum
CREATE TYPE "booking_channel" AS ENUM ('reception', 'phone', 'portal', 'referral', 'walk_in');

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "mrn" VARCHAR(20) NOT NULL,
    "title" VARCHAR(12) NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "alias" VARCHAR(120),
    "aadhaar_last4" CHAR(4),
    "abha_number" VARCHAR(20),
    "mobile" VARCHAR(10) NOT NULL,
    "alt_mobile" VARCHAR(10),
    "email" VARCHAR(254),
    "address_line" VARCHAR(240),
    "area" VARCHAR(160),
    "city" VARCHAR(80),
    "state" VARCHAR(80),
    "pin_code" CHAR(6) NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "gender" "gender" NOT NULL,
    "blood_group" VARCHAR(3),
    "language" VARCHAR(40),
    "emergency_name" VARCHAR(120),
    "emergency_relation" VARCHAR(40),
    "emergency_phone" VARCHAR(10),
    "notify_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "notify_sms" BOOLEAN NOT NULL DEFAULT true,
    "home_branch_id" UUID NOT NULL,
    "intake_unit" VARCHAR(80),
    "status" "patient_status" NOT NULL DEFAULT 'active',
    "status_note" VARCHAR(160),
    "portal_user_id" UUID,
    "created_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioners" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "credentials" VARCHAR(120),
    "specialty" VARCHAR(120) NOT NULL,
    "department" VARCHAR(120) NOT NULL,
    "room" VARCHAR(60),
    "slot_minutes" INTEGER NOT NULL,
    "status" "practitioner_status" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "practitioners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioner_availability" (
    "id" UUID NOT NULL,
    "practitioner_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "start_minute" SMALLINT NOT NULL,
    "end_minute" SMALLINT NOT NULL,

    CONSTRAINT "practitioner_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "patient_id" UUID NOT NULL,
    "practitioner_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "type" "appointment_type" NOT NULL,
    "status" "appointment_status" NOT NULL,
    "channel" "booking_channel" NOT NULL,
    "waiting_queue" BOOLEAN NOT NULL DEFAULT false,
    "reason" VARCHAR(500) NOT NULL,
    "internal_note" VARCHAR(1000),
    "notify_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "notify_sms" BOOLEAN NOT NULL DEFAULT true,
    "queue_token" VARCHAR(10),
    "arrived_at" TIMESTAMPTZ(6),
    "closed_reason" VARCHAR(120),
    "booked_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_events" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "from_status" "appointment_status",
    "to_status" "appointment_status" NOT NULL,
    "from_starts_at" TIMESTAMPTZ(6),
    "to_starts_at" TIMESTAMPTZ(6),
    "reason" VARCHAR(120),
    "note" VARCHAR(1000),
    "actor_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_counters" (
    "org_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "org_counters_pkey" PRIMARY KEY ("org_id","name")
);

-- CreateIndex
CREATE UNIQUE INDEX "patients_portal_user_id_key" ON "patients"("portal_user_id");

-- CreateIndex
CREATE INDEX "patients_org_id_mobile_idx" ON "patients"("org_id", "mobile");

-- CreateIndex
CREATE INDEX "patients_org_id_status_created_at_idx" ON "patients"("org_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "patients_org_id_full_name_idx" ON "patients"("org_id", "full_name");

-- CreateIndex
CREATE UNIQUE INDEX "patients_org_id_mrn_key" ON "patients"("org_id", "mrn");

-- CreateIndex
CREATE UNIQUE INDEX "practitioners_membership_id_key" ON "practitioners"("membership_id");

-- CreateIndex
CREATE INDEX "practitioners_org_id_status_idx" ON "practitioners"("org_id", "status");

-- CreateIndex
CREATE INDEX "practitioner_availability_practitioner_id_weekday_idx" ON "practitioner_availability"("practitioner_id", "weekday");

-- CreateIndex
CREATE INDEX "appointments_org_id_practitioner_id_starts_at_idx" ON "appointments"("org_id", "practitioner_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_org_id_patient_id_starts_at_idx" ON "appointments"("org_id", "patient_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_org_id_branch_id_starts_at_idx" ON "appointments"("org_id", "branch_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_org_id_reference_key" ON "appointments"("org_id", "reference");

-- CreateIndex
CREATE INDEX "appointment_events_appointment_id_created_at_idx" ON "appointment_events"("appointment_id", "created_at");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_home_branch_id_fkey" FOREIGN KEY ("home_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_availability" ADD CONSTRAINT "practitioner_availability_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_availability" ADD CONSTRAINT "practitioner_availability_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_booked_by_fkey" FOREIGN KEY ("booked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_counters" ADD CONSTRAINT "org_counters_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Integrity rules Prisma cannot express ─────────────────────────────────
-- Exclusion constraints need GiST support for plain equality on uuid and smallint columns.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "patients"
  ADD CONSTRAINT "patients_mobile_format" CHECK ("mobile" ~ '^[6-9][0-9]{9}$'),
  ADD CONSTRAINT "patients_alt_mobile_format" CHECK ("alt_mobile" IS NULL OR "alt_mobile" ~ '^[6-9][0-9]{9}$'),
  ADD CONSTRAINT "patients_emergency_phone_format" CHECK ("emergency_phone" IS NULL OR "emergency_phone" ~ '^[6-9][0-9]{9}$'),
  ADD CONSTRAINT "patients_pin_code_format" CHECK ("pin_code" ~ '^[0-9]{6}$'),
  ADD CONSTRAINT "patients_aadhaar_last4_format" CHECK ("aadhaar_last4" IS NULL OR "aadhaar_last4" ~ '^[0-9]{4}$'),
  ADD CONSTRAINT "patients_email_lowercase" CHECK ("email" IS NULL OR "email" = lower("email")),
  ADD CONSTRAINT "patients_blood_group_valid" CHECK ("blood_group" IS NULL OR "blood_group" IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));

ALTER TABLE "practitioners"
  ADD CONSTRAINT "practitioners_slot_minutes_range" CHECK ("slot_minutes" BETWEEN 5 AND 240);

ALTER TABLE "practitioner_availability"
  ADD CONSTRAINT "practitioner_availability_weekday_range" CHECK ("weekday" BETWEEN 0 AND 6),
  ADD CONSTRAINT "practitioner_availability_window_valid" CHECK ("start_minute" >= 0 AND "start_minute" < "end_minute" AND "end_minute" <= 1440),
  -- A practitioner cannot be in two places (or two overlapping windows) on the same weekday.
  ADD CONSTRAINT "practitioner_availability_no_overlap" EXCLUDE USING gist (
    "practitioner_id" WITH =,
    "weekday" WITH =,
    int4range("start_minute"::int, "end_minute"::int) WITH &&
  );

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_time_order" CHECK ("ends_at" > "starts_at"),
  -- No double booking: while an appointment is open, nobody else can hold an overlapping slot with the same
  -- practitioner, and the same patient cannot be booked twice at overlapping times. Enforced by the database,
  -- so two receptionists booking the same slot at the same moment cannot both succeed.
  ADD CONSTRAINT "appointments_practitioner_no_overlap" EXCLUDE USING gist (
    "practitioner_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" IN ('pending', 'confirmed', 'arrived', 'in_progress') AND NOT "waiting_queue"),
  ADD CONSTRAINT "appointments_patient_no_overlap" EXCLUDE USING gist (
    "patient_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" IN ('pending', 'confirmed', 'arrived', 'in_progress') AND NOT "waiting_queue");

ALTER TABLE "org_counters"
  ADD CONSTRAINT "org_counters_value_positive" CHECK ("value" >= 0);
