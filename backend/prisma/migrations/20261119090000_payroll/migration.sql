-- CreateEnum
CREATE TYPE "pay_employment" AS ENUM ('full_time', 'part_time', 'contract_locum', 'consultant');

-- CreateEnum
CREATE TYPE "pay_model" AS ENUM ('monthly', 'visit', 'shift', 'hourly');

-- CreateEnum
CREATE TYPE "payroll_cycle_status" AS ENUM ('draft', 'approved', 'processed');

-- CreateEnum
CREATE TYPE "payroll_entry_status" AS ENUM ('ready', 'needs_review', 'on_hold');

-- CreateEnum
CREATE TYPE "pay_adjustment_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "advance_status" AS ENUM ('pending_approval', 'pending_disbursal', 'awaiting_acknowledgement', 'active', 'settled', 'rejected');

-- CreateTable
CREATE TABLE "payroll_settings" (
    "org_id" UUID NOT NULL,
    "epf_enabled" BOOLEAN NOT NULL DEFAULT true,
    "epf_rate_bp" INTEGER NOT NULL DEFAULT 1200,
    "epf_cap" INTEGER NOT NULL DEFAULT 180000,
    "esic_enabled" BOOLEAN NOT NULL DEFAULT true,
    "esic_rate_bp" INTEGER NOT NULL DEFAULT 75,
    "esic_ceiling" INTEGER NOT NULL DEFAULT 2100000,
    "pt_enabled" BOOLEAN NOT NULL DEFAULT true,
    "pt_state" VARCHAR(60) NOT NULL DEFAULT 'Telangana',
    "pt_slabs" JSONB NOT NULL,
    "tds_enabled" BOOLEAN NOT NULL DEFAULT true,
    "tds_rate_bp" INTEGER NOT NULL DEFAULT 1000,
    "pay_day" INTEGER NOT NULL DEFAULT 5,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("org_id")
);

-- CreateTable
CREATE TABLE "pay_profiles" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "employment" "pay_employment" NOT NULL,
    "model" "pay_model" NOT NULL,
    "rate" INTEGER NOT NULL,
    "bank_name" VARCHAR(80) NOT NULL,
    "ifsc" VARCHAR(11) NOT NULL,
    "account_last4" VARCHAR(4) NOT NULL,
    "bank_verified" BOOLEAN NOT NULL DEFAULT false,
    "bank_verified_by" UUID,
    "bank_verified_at" TIMESTAMPTZ(6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pay_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_cycles" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "status" "payroll_cycle_status" NOT NULL DEFAULT 'draft',
    "scope_branch_ids" UUID[],
    "scope_employment" "pay_employment"[],
    "pay_date" DATE NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "processed_by" UUID,
    "processed_at" TIMESTAMPTZ(6),
    "staff_count" INTEGER,
    "gross" INTEGER,
    "additions" INTEGER,
    "deductions" INTEGER,
    "statutory" INTEGER,
    "advances" INTEGER,
    "net" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payroll_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_entries" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "status" "payroll_entry_status" NOT NULL DEFAULT 'ready',
    "status_note" VARCHAR(300) NOT NULL DEFAULT '',
    "entered" INTEGER,
    "entered_reason" VARCHAR(300),
    "payslip_ref" VARCHAR(20),
    "branch_id" UUID,
    "employment" "pay_employment",
    "model" "pay_model",
    "rate" INTEGER,
    "quantity" INTEGER,
    "quantity_note" VARCHAR(300),
    "gross" INTEGER,
    "additions" INTEGER,
    "deductions" INTEGER,
    "statutory" JSONB,
    "advance" INTEGER,
    "net" INTEGER,
    "payment_ref" VARCHAR(60),
    "paid_at" TIMESTAMPTZ(6),
    "paid_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_adjustments" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "staff_id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "document_ref" VARCHAR(80),
    "status" "pay_adjustment_status" NOT NULL DEFAULT 'pending',
    "requested_by" UUID NOT NULL,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "comment" VARCHAR(500),
    "cycle_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_advances" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "staff_id" UUID NOT NULL,
    "principal" INTEGER NOT NULL,
    "installments" INTEGER NOT NULL,
    "start_month" VARCHAR(7) NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "method" VARCHAR(40),
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "status" "advance_status" NOT NULL,
    "disbursal_date" DATE,
    "decision_note" VARCHAR(500),
    "created_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "disbursed_at" TIMESTAMPTZ(6),
    "acknowledged_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payroll_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_recoveries" (
    "id" UUID NOT NULL,
    "advance_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advance_recoveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_events" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "entity_type" VARCHAR(30) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pay_profiles_staff_id_key" ON "pay_profiles"("staff_id");

-- CreateIndex
CREATE INDEX "pay_profiles_org_id_idx" ON "pay_profiles"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_cycles_org_id_month_key" ON "payroll_cycles"("org_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_cycles_org_id_reference_key" ON "payroll_cycles"("org_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_entries_cycle_id_staff_id_key" ON "payroll_entries"("cycle_id", "staff_id");

-- CreateIndex
CREATE INDEX "payroll_adjustments_org_id_month_idx" ON "payroll_adjustments"("org_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_adjustments_org_id_reference_key" ON "payroll_adjustments"("org_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_advances_org_id_reference_key" ON "payroll_advances"("org_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "advance_recoveries_advance_id_cycle_id_key" ON "advance_recoveries"("advance_id", "cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "advance_recoveries_advance_id_number_key" ON "advance_recoveries"("advance_id", "number");

-- CreateIndex
CREATE INDEX "payroll_events_org_id_created_at_idx" ON "payroll_events"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "payroll_events_org_id_entity_type_entity_id_idx" ON "payroll_events"("org_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_profiles" ADD CONSTRAINT "pay_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_profiles" ADD CONSTRAINT "pay_profiles_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_profiles" ADD CONSTRAINT "pay_profiles_bank_verified_by_fkey" FOREIGN KEY ("bank_verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_cycles" ADD CONSTRAINT "payroll_cycles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_cycles" ADD CONSTRAINT "payroll_cycles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_cycles" ADD CONSTRAINT "payroll_cycles_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_cycles" ADD CONSTRAINT "payroll_cycles_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "payroll_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "payroll_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_advances" ADD CONSTRAINT "payroll_advances_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_advances" ADD CONSTRAINT "payroll_advances_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_advances" ADD CONSTRAINT "payroll_advances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_advances" ADD CONSTRAINT "payroll_advances_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_recoveries" ADD CONSTRAINT "advance_recoveries_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "payroll_advances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_recoveries" ADD CONSTRAINT "advance_recoveries_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "payroll_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_recoveries" ADD CONSTRAINT "advance_recoveries_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "payroll_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_events" ADD CONSTRAINT "payroll_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_events" ADD CONSTRAINT "payroll_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Guards the application also enforces, kept in the database so no write path can break them.
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_rates_check"
  CHECK ("epf_rate_bp" BETWEEN 0 AND 10000 AND "esic_rate_bp" BETWEEN 0 AND 10000 AND "tds_rate_bp" BETWEEN 0 AND 10000
    AND "epf_cap" >= 0 AND "esic_ceiling" >= 0 AND "pay_day" BETWEEN 1 AND 28);
ALTER TABLE "pay_profiles" ADD CONSTRAINT "pay_profiles_rate_check" CHECK ("rate" > 0);
ALTER TABLE "pay_profiles" ADD CONSTRAINT "pay_profiles_bank_check"
  CHECK ("ifsc" ~ '^[A-Z]{4}0[A-Z0-9]{6}$' AND "account_last4" ~ '^[0-9]{4}$');
ALTER TABLE "pay_profiles" ADD CONSTRAINT "pay_profiles_verified_check" CHECK ("bank_verified" = ("bank_verified_at" IS NOT NULL));
ALTER TABLE "payroll_cycles" ADD CONSTRAINT "payroll_cycles_month_check" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "payroll_cycles" ADD CONSTRAINT "payroll_cycles_status_check"
  CHECK (("status" = 'draft' OR "approved_at" IS NOT NULL) AND (("status" = 'processed') = ("processed_at" IS NOT NULL AND "net" IS NOT NULL)));
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_entered_check"
  CHECK ("entered" IS NULL OR "entered" >= 0);
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_payment_check" CHECK (("payment_ref" IS NULL) = ("paid_at" IS NULL));
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_amount_check"
  CHECK ("amount" > 0 AND "direction" IN ('addition', 'deduction') AND "month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_decision_check"
  CHECK (("status" = 'pending') = ("decided_at" IS NULL) AND ("cycle_id" IS NULL OR "status" = 'approved'));
ALTER TABLE "payroll_advances" ADD CONSTRAINT "payroll_advances_amount_check"
  CHECK ("principal" > 0 AND "installments" BETWEEN 1 AND 12 AND "start_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "advance_recoveries" ADD CONSTRAINT "advance_recoveries_amount_check" CHECK ("amount" > 0 AND "number" >= 1);
