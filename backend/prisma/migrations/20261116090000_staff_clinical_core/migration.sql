-- CreateEnum
CREATE TYPE "staff_type" AS ENUM ('doctor', 'staff');

-- CreateEnum
CREATE TYPE "staff_status" AS ENUM ('active', 'draft', 'inactive');

-- CreateEnum
CREATE TYPE "engagement" AS ENUM ('full_time', 'visiting', 'honorary');

-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('present', 'late', 'absent', 'leave', 'unavailable');

-- CreateEnum
CREATE TYPE "leave_kind" AS ENUM ('leave', 'block', 'relief');

-- CreateEnum
CREATE TYPE "leave_status" AS ENUM ('scheduled', 'cancelled');

-- CreateEnum
CREATE TYPE "encounter_status" AS ENUM ('in_progress', 'signed');

-- CreateEnum
CREATE TYPE "diagnosis_status" AS ENUM ('active', 'resolved');

-- CreateEnum
CREATE TYPE "allergy_severity" AS ENUM ('mild', 'moderate', 'severe');

-- CreateEnum
CREATE TYPE "alert_severity" AS ENUM ('critical', 'high', 'moderate', 'low');

-- CreateEnum
CREATE TYPE "alert_status" AS ENUM ('active', 'acknowledged', 'resolved');

-- CreateTable
CREATE TABLE "staff_members" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "staff_code" VARCHAR(20) NOT NULL,
    "type" "staff_type" NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254),
    "mobile" VARCHAR(10),
    "department" VARCHAR(120) NOT NULL,
    "designation" VARCHAR(160) NOT NULL,
    "council" VARCHAR(120),
    "council_number" VARCHAR(60),
    "qualifications" VARCHAR(60)[],
    "engagement" "engagement" NOT NULL DEFAULT 'full_time',
    "status" "staff_status" NOT NULL DEFAULT 'active',
    "membership_id" UUID,
    "invitation_id" UUID,
    "created_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_branches" (
    "staff_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_branches_pkey" PRIMARY KEY ("staff_id","branch_id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "attendance_status" NOT NULL,
    "arrival_minute" SMALLINT,
    "note" VARCHAR(500),
    "recorded_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_corrections" (
    "id" UUID NOT NULL,
    "attendance_id" UUID NOT NULL,
    "from_status" "attendance_status" NOT NULL,
    "to_status" "attendance_status" NOT NULL,
    "from_minute" SMALLINT,
    "to_minute" SMALLINT,
    "reason" VARCHAR(500) NOT NULL,
    "corrected_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_leaves" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "kind" "leave_kind" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "start_minute" SMALLINT,
    "end_minute" SMALLINT,
    "branch_id" UUID,
    "reason" VARCHAR(500) NOT NULL,
    "status" "leave_status" NOT NULL DEFAULT 'scheduled',
    "created_by" UUID NOT NULL,
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "patient_id" UUID NOT NULL,
    "appointment_id" UUID,
    "practitioner_id" UUID,
    "branch_id" UUID NOT NULL,
    "type" VARCHAR(120) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "chief_complaint" VARCHAR(2000) NOT NULL DEFAULT '',
    "subjective" VARCHAR(4000) NOT NULL DEFAULT '',
    "objective" VARCHAR(4000) NOT NULL DEFAULT '',
    "assessment" VARCHAR(4000) NOT NULL DEFAULT '',
    "plan" VARCHAR(4000) NOT NULL DEFAULT '',
    "status" "encounter_status" NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signed_at" TIMESTAMPTZ(6),
    "signed_by" UUID,
    "created_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vital_signs" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "systolic" SMALLINT NOT NULL,
    "diastolic" SMALLINT NOT NULL,
    "pulse" SMALLINT NOT NULL,
    "respiration" SMALLINT NOT NULL,
    "temperature_f" DOUBLE PRECISION NOT NULL,
    "spo2" SMALLINT NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "height_cm" DOUBLE PRECISION NOT NULL,
    "blood_sugar" SMALLINT,
    "pain_score" SMALLINT,
    "site" VARCHAR(120),
    "posture" VARCHAR(120),
    "device" VARCHAR(120),
    "recorded_by" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vital_signs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "icd" VARCHAR(20) NOT NULL,
    "snomed" VARCHAR(20),
    "name" VARCHAR(240) NOT NULL,
    "designation" VARCHAR(20) NOT NULL DEFAULT 'Primary',
    "verification" VARCHAR(20) NOT NULL DEFAULT 'Confirmed',
    "severity" VARCHAR(60),
    "description" VARCHAR(2000) NOT NULL,
    "status" "diagnosis_status" NOT NULL DEFAULT 'active',
    "recorded_by" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allergies" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "substance" VARCHAR(160) NOT NULL,
    "drug_class" VARCHAR(60),
    "class_label" VARCHAR(120),
    "severity" "allergy_severity" NOT NULL,
    "reaction" VARCHAR(500) NOT NULL,
    "verification" VARCHAR(60),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "recorded_by" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_alerts" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "kind" VARCHAR(80) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "severity" "alert_severity" NOT NULL,
    "status" "alert_status" NOT NULL DEFAULT 'active',
    "detail" VARCHAR(2000) NOT NULL,
    "statement" VARCHAR(2000),
    "allergy_id" UUID,
    "disposition" VARCHAR(60),
    "justification" VARCHAR(2000),
    "acknowledged_by" UUID,
    "acknowledged_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_notes" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "title" VARCHAR(240) NOT NULL,
    "department" VARCHAR(120),
    "sections" JSONB NOT NULL,
    "author_id" UUID NOT NULL,
    "signed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_addenda" (
    "id" UUID NOT NULL,
    "note_id" UUID NOT NULL,
    "text" VARCHAR(4000) NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_addenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_membership_id_key" ON "staff_members"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_invitation_id_key" ON "staff_members"("invitation_id");

-- CreateIndex
CREATE INDEX "staff_members_org_id_status_idx" ON "staff_members"("org_id", "status");

-- CreateIndex
CREATE INDEX "staff_members_org_id_full_name_idx" ON "staff_members"("org_id", "full_name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_org_id_staff_code_key" ON "staff_members"("org_id", "staff_code");

-- CreateIndex
CREATE INDEX "staff_branches_branch_id_idx" ON "staff_branches"("branch_id");

-- CreateIndex
CREATE INDEX "attendance_records_staff_id_date_idx" ON "attendance_records"("staff_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_staff_id_branch_id_date_key" ON "attendance_records"("staff_id", "branch_id", "date");

-- CreateIndex
CREATE INDEX "attendance_corrections_attendance_id_created_at_idx" ON "attendance_corrections"("attendance_id", "created_at");

-- CreateIndex
CREATE INDEX "staff_leaves_staff_id_start_date_idx" ON "staff_leaves"("staff_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "encounters_appointment_id_key" ON "encounters"("appointment_id");

-- CreateIndex
CREATE INDEX "encounters_org_id_patient_id_started_at_idx" ON "encounters"("org_id", "patient_id", "started_at");

-- CreateIndex
CREATE INDEX "encounters_org_id_status_idx" ON "encounters"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "encounters_org_id_reference_key" ON "encounters"("org_id", "reference");

-- CreateIndex
CREATE INDEX "vital_signs_org_id_patient_id_recorded_at_idx" ON "vital_signs"("org_id", "patient_id", "recorded_at");

-- CreateIndex
CREATE INDEX "diagnoses_org_id_patient_id_status_idx" ON "diagnoses"("org_id", "patient_id", "status");

-- CreateIndex
CREATE INDEX "allergies_org_id_patient_id_idx" ON "allergies"("org_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_alerts_allergy_id_key" ON "clinical_alerts"("allergy_id");

-- CreateIndex
CREATE INDEX "clinical_alerts_org_id_patient_id_status_idx" ON "clinical_alerts"("org_id", "patient_id", "status");

-- CreateIndex
CREATE INDEX "clinical_alerts_org_id_status_severity_idx" ON "clinical_alerts"("org_id", "status", "severity");

-- CreateIndex
CREATE INDEX "clinical_notes_org_id_patient_id_signed_at_idx" ON "clinical_notes"("org_id", "patient_id", "signed_at");

-- CreateIndex
CREATE INDEX "note_addenda_note_id_created_at_idx" ON "note_addenda"("note_id", "created_at");

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_branches" ADD CONSTRAINT "staff_branches_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_branches" ADD CONSTRAINT "staff_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_corrected_by_fkey" FOREIGN KEY ("corrected_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_alerts" ADD CONSTRAINT "clinical_alerts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_alerts" ADD CONSTRAINT "clinical_alerts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_alerts" ADD CONSTRAINT "clinical_alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_alerts" ADD CONSTRAINT "clinical_alerts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_addenda" ADD CONSTRAINT "note_addenda_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "clinical_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_addenda" ADD CONSTRAINT "note_addenda_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Integrity rules Prisma cannot express ─────────────────────────────────
ALTER TABLE "staff_members"
  ADD CONSTRAINT "staff_members_mobile_format" CHECK ("mobile" IS NULL OR "mobile" ~ '^[6-9][0-9]{9}$'),
  ADD CONSTRAINT "staff_members_email_lowercase" CHECK ("email" IS NULL OR "email" = lower("email"));

-- At most one primary branch per person.
CREATE UNIQUE INDEX "staff_branches_one_primary" ON "staff_branches" ("staff_id") WHERE "is_primary";

ALTER TABLE "attendance_records"
  ADD CONSTRAINT "attendance_records_arrival_range" CHECK ("arrival_minute" IS NULL OR "arrival_minute" BETWEEN 0 AND 1439),
  -- An arrival time belongs to present and late, and only to them.
  ADD CONSTRAINT "attendance_records_arrival_matches_status" CHECK (("status" IN ('present', 'late')) = ("arrival_minute" IS NOT NULL));

ALTER TABLE "staff_leaves"
  ADD CONSTRAINT "staff_leaves_date_order" CHECK ("end_date" >= "start_date"),
  ADD CONSTRAINT "staff_leaves_window_valid" CHECK (
    ("start_minute" IS NULL AND "end_minute" IS NULL)
    OR ("start_minute" >= 0 AND "start_minute" < "end_minute" AND "end_minute" <= 1440)
  );

ALTER TABLE "vital_signs"
  ADD CONSTRAINT "vital_signs_ranges" CHECK (
    "systolic" BETWEEN 50 AND 300 AND "diastolic" BETWEEN 30 AND 200 AND "diastolic" < "systolic"
    AND "pulse" BETWEEN 20 AND 250 AND "respiration" BETWEEN 4 AND 80
    AND "temperature_f" BETWEEN 90 AND 110 AND "spo2" BETWEEN 50 AND 100
    AND "weight_kg" > 0 AND "weight_kg" <= 400 AND "height_cm" BETWEEN 30 AND 250
    AND ("pain_score" IS NULL OR "pain_score" BETWEEN 0 AND 10)
    AND ("blood_sugar" IS NULL OR "blood_sugar" BETWEEN 10 AND 1000)
  );

-- A signed encounter carries who signed it and when.
ALTER TABLE "encounters"
  ADD CONSTRAINT "encounters_signature_complete" CHECK (("status" = 'signed') = ("signed_at" IS NOT NULL AND "signed_by" IS NOT NULL));

ALTER TABLE "clinical_alerts"
  ADD CONSTRAINT "clinical_alerts_acknowledgement_complete" CHECK (
    "status" <> 'acknowledged' OR ("disposition" IS NOT NULL AND "justification" IS NOT NULL AND "acknowledged_by" IS NOT NULL)
  );

ALTER TABLE "clinical_notes"
  ADD CONSTRAINT "clinical_notes_sections_array" CHECK (jsonb_typeof("sections") = 'array' AND jsonb_array_length("sections") > 0);
