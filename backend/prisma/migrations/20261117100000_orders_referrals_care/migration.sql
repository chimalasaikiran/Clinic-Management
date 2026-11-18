-- CreateEnum
CREATE TYPE "prescription_status" AS ENUM ('active', 'completed', 'discontinued');

-- CreateEnum
CREATE TYPE "order_kind" AS ENUM ('lab', 'imaging');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('ordered', 'processing', 'awaiting_review', 'reviewed', 'cancelled');

-- CreateEnum
CREATE TYPE "result_flag" AS ENUM ('normal', 'abnormal', 'critical');

-- CreateEnum
CREATE TYPE "referral_direction" AS ENUM ('outgoing', 'incoming');

-- CreateEnum
CREATE TYPE "referral_status" AS ENUM ('pending_acceptance', 'awaiting_review', 'info_requested', 'accepted', 'scheduled', 'completed', 'declined', 'cancelled');

-- CreateEnum
CREATE TYPE "care_plan_status" AS ENUM ('on_track', 'at_risk', 'achieved', 'closed');

-- AlterTable
ALTER TABLE "clinical_alerts" ADD COLUMN     "order_id" UUID;

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "branch_id" UUID NOT NULL,
    "prescriber_name" VARCHAR(120) NOT NULL,
    "registration" VARCHAR(80),
    "department" VARCHAR(120),
    "indication" VARCHAR(500) NOT NULL,
    "precaution_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "status" "prescription_status" NOT NULL DEFAULT 'active',
    "content_hash" CHAR(64) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "medicine_code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "strength" VARCHAR(40) NOT NULL,
    "form" VARCHAR(40) NOT NULL,
    "route" VARCHAR(40) NOT NULL,
    "drug_class" VARCHAR(60),
    "dose" VARCHAR(60) NOT NULL,
    "frequency" VARCHAR(80) NOT NULL,
    "frequency_per_day" SMALLINT NOT NULL,
    "food" VARCHAR(40) NOT NULL,
    "duration_days" SMALLINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "refills" SMALLINT NOT NULL DEFAULT 0,
    "instructions" VARCHAR(1000) NOT NULL DEFAULT '',
    "indication" VARCHAR(500) NOT NULL,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_events" (
    "id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_orders" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "branch_id" UUID NOT NULL,
    "ordering_name" VARCHAR(160) NOT NULL,
    "kind" "order_kind" NOT NULL,
    "category" VARCHAR(120) NOT NULL,
    "title" VARCHAR(1000) NOT NULL,
    "indication" VARCHAR(2000) NOT NULL,
    "performing" VARCHAR(240) NOT NULL,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "status" "order_status" NOT NULL DEFAULT 'ordered',
    "accession" VARCHAR(40),
    "specimen_note" VARCHAR(1000),
    "result_summary" VARCHAR(4000),
    "result_flag" "result_flag",
    "review_outcome" VARCHAR(20),
    "review_note" VARCHAR(2000),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "diagnostic_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(240) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "loinc" VARCHAR(20),
    "destination" VARCHAR(240) NOT NULL,
    "priority" VARCHAR(60) NOT NULL,

    CONSTRAINT "diagnostic_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "note" VARCHAR(2000) NOT NULL DEFAULT '',
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "direction" "referral_direction" NOT NULL,
    "status" "referral_status" NOT NULL,
    "priority" VARCHAR(60) NOT NULL,
    "window_hours" SMALLINT NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "specialty" VARCHAR(120) NOT NULL,
    "indication" VARCHAR(500) NOT NULL,
    "narrative" VARCHAR(4000) NOT NULL,
    "questions" VARCHAR(500)[],
    "attached_records" VARCHAR(240)[],
    "target_practitioner_id" UUID,
    "facility" VARCHAR(240) NOT NULL,
    "facility_note" VARCHAR(240) NOT NULL DEFAULT '',
    "clinician" VARCHAR(160) NOT NULL,
    "clinician_note" VARCHAR(240) NOT NULL DEFAULT '',
    "outcome" VARCHAR(240) NOT NULL DEFAULT '',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_events" (
    "id" UUID NOT NULL,
    "referral_id" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "text" VARCHAR(2000) NOT NULL DEFAULT '',
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_plans" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "patient_id" UUID NOT NULL,
    "lead_practitioner_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "category" VARCHAR(120) NOT NULL,
    "rationale" VARCHAR(4000) NOT NULL,
    "start_date" DATE NOT NULL,
    "next_review" DATE NOT NULL,
    "target_date" DATE NOT NULL,
    "diagnoses" JSONB NOT NULL,
    "education" VARCHAR(500)[],
    "whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "status" "care_plan_status" NOT NULL DEFAULT 'on_track',
    "compliance" SMALLINT NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_plan_goals" (
    "id" UUID NOT NULL,
    "care_plan_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "target" VARCHAR(200) NOT NULL,
    "protocol" VARCHAR(500) NOT NULL DEFAULT '',
    "cadence" VARCHAR(80) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'Pending Baseline',
    "observation" VARCHAR(1000),

    CONSTRAINT "care_plan_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_plan_interventions" (
    "id" UUID NOT NULL,
    "care_plan_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "due" VARCHAR(120) NOT NULL DEFAULT '',
    "state" VARCHAR(40) NOT NULL DEFAULT 'Staged',

    CONSTRAINT "care_plan_interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_plan_reviews" (
    "id" UUID NOT NULL,
    "care_plan_id" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "observation" VARCHAR(2000) NOT NULL,
    "summary" VARCHAR(2000) NOT NULL,
    "barriers" VARCHAR(120)[],
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_plan_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "patient_id" UUID,
    "branch_id" UUID NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "severity" SMALLINT NOT NULL,
    "occurred_on" DATE NOT NULL,
    "occurred_time" VARCHAR(5) NOT NULL,
    "zone" VARCHAR(160) NOT NULL,
    "headline" VARCHAR(240) NOT NULL,
    "chronology" VARCHAR(4000) NOT NULL,
    "factors" VARCHAR(120)[],
    "actions" VARCHAR(2000) NOT NULL DEFAULT '',
    "witnesses" VARCHAR(160)[],
    "notify_quality" BOOLEAN NOT NULL DEFAULT true,
    "log_register" BOOLEAN NOT NULL DEFAULT true,
    "reporter_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescriptions_org_id_patient_id_created_at_idx" ON "prescriptions"("org_id", "patient_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_org_id_reference_key" ON "prescriptions"("org_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "prescription_items_prescription_id_position_key" ON "prescription_items"("prescription_id", "position");

-- CreateIndex
CREATE INDEX "prescription_events_prescription_id_created_at_idx" ON "prescription_events"("prescription_id", "created_at");

-- CreateIndex
CREATE INDEX "diagnostic_orders_org_id_patient_id_created_at_idx" ON "diagnostic_orders"("org_id", "patient_id", "created_at");

-- CreateIndex
CREATE INDEX "diagnostic_orders_org_id_status_idx" ON "diagnostic_orders"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_orders_org_id_reference_key" ON "diagnostic_orders"("org_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_order_items_order_id_position_key" ON "diagnostic_order_items"("order_id", "position");

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "referrals_org_id_patient_id_created_at_idx" ON "referrals"("org_id", "patient_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_org_id_reference_key" ON "referrals"("org_id", "reference");

-- CreateIndex
CREATE INDEX "referral_events_referral_id_created_at_idx" ON "referral_events"("referral_id", "created_at");

-- CreateIndex
CREATE INDEX "care_plans_org_id_patient_id_idx" ON "care_plans"("org_id", "patient_id");

-- CreateIndex
CREATE INDEX "care_plans_org_id_status_next_review_idx" ON "care_plans"("org_id", "status", "next_review");

-- CreateIndex
CREATE UNIQUE INDEX "care_plans_org_id_reference_key" ON "care_plans"("org_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "care_plan_goals_care_plan_id_position_key" ON "care_plan_goals"("care_plan_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "care_plan_interventions_care_plan_id_position_key" ON "care_plan_interventions"("care_plan_id", "position");

-- CreateIndex
CREATE INDEX "care_plan_reviews_care_plan_id_created_at_idx" ON "care_plan_reviews"("care_plan_id", "created_at");

-- CreateIndex
CREATE INDEX "incidents_org_id_created_at_idx" ON "incidents"("org_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_org_id_reference_key" ON "incidents"("org_id", "reference");

-- AddForeignKey
ALTER TABLE "clinical_alerts" ADD CONSTRAINT "clinical_alerts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "diagnostic_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_events" ADD CONSTRAINT "prescription_events_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_events" ADD CONSTRAINT "prescription_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_order_items" ADD CONSTRAINT "diagnostic_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "diagnostic_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "diagnostic_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_target_practitioner_id_fkey" FOREIGN KEY ("target_practitioner_id") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_events" ADD CONSTRAINT "referral_events_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_events" ADD CONSTRAINT "referral_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_lead_practitioner_id_fkey" FOREIGN KEY ("lead_practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plan_goals" ADD CONSTRAINT "care_plan_goals_care_plan_id_fkey" FOREIGN KEY ("care_plan_id") REFERENCES "care_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plan_interventions" ADD CONSTRAINT "care_plan_interventions_care_plan_id_fkey" FOREIGN KEY ("care_plan_id") REFERENCES "care_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plan_reviews" ADD CONSTRAINT "care_plan_reviews_care_plan_id_fkey" FOREIGN KEY ("care_plan_id") REFERENCES "care_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plan_reviews" ADD CONSTRAINT "care_plan_reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Rules the database enforces itself (not expressible in the Prisma schema) ──

-- An alert raised by a result is found from its order.
CREATE INDEX "clinical_alerts_order_id_idx" ON "clinical_alerts"("order_id");

-- Prescriptions: sensible quantities and a full SHA-256 hash.
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_hash_check" CHECK ("content_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_amounts_check"
  CHECK ("duration_days" BETWEEN 1 AND 365 AND "frequency_per_day" BETWEEN 1 AND 6 AND "quantity" > 0 AND "refills" BETWEEN 0 AND 12);

-- Diagnostic orders: a result exists from "awaiting review" on, a review only once reviewed.
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_result_check"
  CHECK (("status" IN ('awaiting_review', 'reviewed')) = ("result_summary" IS NOT NULL AND "result_flag" IS NOT NULL));
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_review_check"
  CHECK (("status" = 'reviewed') = ("review_outcome" IS NOT NULL AND "review_note" IS NOT NULL));

-- Referrals: a response window and only the statuses that fit the direction.
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_window_check" CHECK ("window_hours" BETWEEN 1 AND 2160);
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_direction_status_check"
  CHECK (("direction" = 'outgoing' AND "status" <> 'awaiting_review') OR ("direction" = 'incoming' AND "status" IN ('awaiting_review', 'accepted', 'scheduled', 'completed', 'declined', 'cancelled')));

-- Care plans: dates in order and compliance as a percentage.
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_dates_check" CHECK ("start_date" < "target_date" AND "next_review" > "start_date");
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_compliance_check" CHECK ("compliance" BETWEEN 0 AND 100);
ALTER TABLE "care_plan_reviews" ADD CONSTRAINT "care_plan_reviews_kind_check" CHECK ("kind" IN ('progress', 'completed', 'escalated'));

-- Incidents: harm severity 1 to 5 and a clock time.
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_severity_check" CHECK ("severity" BETWEEN 1 AND 5);
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_time_check" CHECK ("occurred_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- An alert raised by an anonymous incident report has no creator.
ALTER TABLE "clinical_alerts" ALTER COLUMN "created_by" DROP NOT NULL;
