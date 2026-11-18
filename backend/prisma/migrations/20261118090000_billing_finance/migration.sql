-- CreateEnum
CREATE TYPE "billing_service_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "tax_treatment" AS ENUM ('exempt', 'no_tax', 'taxable', 'not_configured');

-- CreateEnum
CREATE TYPE "charge_status" AS ENUM ('draft', 'unbilled', 'invoiced');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('pending', 'approved', 'processed', 'failed', 'rejected');

-- CreateEnum
CREATE TYPE "statement_line_state" AS ENUM ('matched', 'candidate', 'exception', 'resolved');

-- CreateEnum
CREATE TYPE "recon_exception_status" AS ENUM ('open', 'in_review', 'resolved');

-- CreateTable
CREATE TABLE "billing_services" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "department" VARCHAR(120),
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "unit" VARCHAR(40),
    "status" "billing_service_status" NOT NULL DEFAULT 'inactive',
    "price" DECIMAL(12,2) NOT NULL,
    "tax_treatment" "tax_treatment" NOT NULL DEFAULT 'not_configured',
    "tax_config" VARCHAR(80),
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "billing_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_service_prices" (
    "service_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "price" DECIMAL(12,2),

    CONSTRAINT "billing_service_prices_pkey" PRIMARY KEY ("service_id","branch_id")
);

-- CreateTable
CREATE TABLE "billing_settings" (
    "org_id" UUID NOT NULL,
    "billing_model" VARCHAR(30) NOT NULL DEFAULT 'Pay-as-you-go',
    "cash_enabled" BOOLEAN NOT NULL DEFAULT true,
    "bank_enabled" BOOLEAN NOT NULL DEFAULT true,
    "upi_enabled" BOOLEAN NOT NULL DEFAULT true,
    "advance_policy" VARCHAR(60) NOT NULL DEFAULT '',
    "partial_policy" VARCHAR(60) NOT NULL DEFAULT '',
    "allocation_policy" VARCHAR(60) NOT NULL DEFAULT '',
    "invoice_document" VARCHAR(60) NOT NULL DEFAULT '',
    "receipt_document" VARCHAR(60) NOT NULL DEFAULT '',
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "billing_settings_pkey" PRIMARY KEY ("org_id")
);

-- CreateTable
CREATE TABLE "finance_events" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "entity_type" VARCHAR(30) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charges" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "patient_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "encounter_id" UUID,
    "service_id" UUID NOT NULL,
    "payer" VARCHAR(60) NOT NULL,
    "model" VARCHAR(30) NOT NULL,
    "charge_date" DATE NOT NULL,
    "status" "charge_status" NOT NULL DEFAULT 'draft',
    "invoice_id" UUID,
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "department" VARCHAR(120),
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gst_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "patient_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "encounter_id" UUID,
    "payer" VARCHAR(60) NOT NULL,
    "model" VARCHAR(30) NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "public_note" VARCHAR(1000) NOT NULL DEFAULT '',
    "internal_note" VARCHAR(1000) NOT NULL DEFAULT '',
    "gross" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "charge_id" UUID,
    "service_id" UUID,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "note" VARCHAR(200) NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gst_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "receipt_number" VARCHAR(20) NOT NULL,
    "patient_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "channel" VARCHAR(40) NOT NULL,
    "payer" VARCHAR(60) NOT NULL,
    "purpose" VARCHAR(20) NOT NULL,
    "txn_reference" VARCHAR(120),
    "narration" VARCHAR(500) NOT NULL DEFAULT '',
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" UUID NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "refund_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "payment_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" VARCHAR(120) NOT NULL,
    "method" VARCHAR(80) NOT NULL,
    "internal_reference" VARCHAR(80) NOT NULL,
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "releases_allocations" BOOLEAN NOT NULL DEFAULT false,
    "status" "refund_status" NOT NULL DEFAULT 'pending',
    "outcome_reference" VARCHAR(120),
    "outcome_note" VARCHAR(1000),
    "requested_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statement_imports" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "source" VARCHAR(60) NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "line_count" INTEGER NOT NULL,
    "imported_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statement_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statement_lines" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "source" VARCHAR(60) NOT NULL,
    "source_reference" VARCHAR(120) NOT NULL,
    "txn_date" DATE NOT NULL,
    "txn_time" VARCHAR(5),
    "amount" DECIMAL(12,2) NOT NULL,
    "narration" VARCHAR(300) NOT NULL DEFAULT '',
    "payment_id" UUID,
    "state" "statement_line_state" NOT NULL,

    CONSTRAINT "statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_exceptions" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "line_id" UUID NOT NULL,
    "kind" VARCHAR(60) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "recon_exception_status" NOT NULL DEFAULT 'open',
    "owner_id" UUID,
    "evidence" VARCHAR(500),
    "resolution_type" VARCHAR(80),
    "resolution_note" VARCHAR(1000),
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "reconciliation_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_services_org_id_code_key" ON "billing_services"("org_id", "code");

-- CreateIndex
CREATE INDEX "finance_events_org_id_entity_type_entity_id_created_at_idx" ON "finance_events"("org_id", "entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "charges_org_id_patient_id_status_idx" ON "charges"("org_id", "patient_id", "status");

-- CreateIndex
CREATE INDEX "charges_org_id_charge_date_idx" ON "charges"("org_id", "charge_date");

-- CreateIndex
CREATE UNIQUE INDEX "charges_org_id_reference_key" ON "charges"("org_id", "reference");

-- CreateIndex
CREATE INDEX "invoices_org_id_patient_id_idx" ON "invoices"("org_id", "patient_id");

-- CreateIndex
CREATE INDEX "invoices_org_id_invoice_date_idx" ON "invoices"("org_id", "invoice_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_org_id_reference_key" ON "invoices"("org_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_charge_id_key" ON "invoice_lines"("charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_invoice_id_position_key" ON "invoice_lines"("invoice_id", "position");

-- CreateIndex
CREATE INDEX "payments_org_id_patient_id_idx" ON "payments"("org_id", "patient_id");

-- CreateIndex
CREATE INDEX "payments_org_id_received_at_idx" ON "payments"("org_id", "received_at");

-- CreateIndex
CREATE INDEX "payments_org_id_txn_reference_idx" ON "payments"("org_id", "txn_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_org_id_reference_key" ON "payments"("org_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_org_id_receipt_number_key" ON "payments"("org_id", "receipt_number");

-- CreateIndex
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");

-- CreateIndex
CREATE INDEX "payment_allocations_invoice_id_idx" ON "payment_allocations"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_org_id_reference_key" ON "payment_allocations"("org_id", "reference");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_org_id_status_idx" ON "refunds"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_org_id_reference_key" ON "refunds"("org_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "statement_imports_org_id_reference_key" ON "statement_imports"("org_id", "reference");

-- CreateIndex
CREATE INDEX "statement_lines_org_id_txn_date_idx" ON "statement_lines"("org_id", "txn_date");

-- CreateIndex
CREATE INDEX "statement_lines_payment_id_idx" ON "statement_lines"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "statement_lines_org_id_source_source_reference_key" ON "statement_lines"("org_id", "source", "source_reference");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_exceptions_line_id_key" ON "reconciliation_exceptions"("line_id");

-- CreateIndex
CREATE INDEX "reconciliation_exceptions_org_id_status_idx" ON "reconciliation_exceptions"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_exceptions_org_id_reference_key" ON "reconciliation_exceptions"("org_id", "reference");

-- AddForeignKey
ALTER TABLE "billing_services" ADD CONSTRAINT "billing_services_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_services" ADD CONSTRAINT "billing_services_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_service_prices" ADD CONSTRAINT "billing_service_prices_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "billing_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_service_prices" ADD CONSTRAINT "billing_service_prices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "billing_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "billing_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_imports" ADD CONSTRAINT "statement_imports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_imports" ADD CONSTRAINT "statement_imports_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "statement_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_exceptions" ADD CONSTRAINT "reconciliation_exceptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_exceptions" ADD CONSTRAINT "reconciliation_exceptions_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "statement_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_exceptions" ADD CONSTRAINT "reconciliation_exceptions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Rules the database enforces itself (not expressible in the Prisma schema) ──

-- Services: a price is never negative and a GST rate is only set for taxable services.
ALTER TABLE "billing_services" ADD CONSTRAINT "billing_services_price_check"
  CHECK ("price" >= 0 AND "gst_rate" >= 0 AND "gst_rate" <= 40 AND ("tax_treatment" = 'taxable' OR "gst_rate" = 0));
ALTER TABLE "billing_service_prices" ADD CONSTRAINT "billing_service_prices_price_check" CHECK ("price" IS NULL OR "price" >= 0);

-- Charges: a positive quantity, a discount within 0-100% and an invoice link exactly when invoiced.
ALTER TABLE "charges" ADD CONSTRAINT "charges_amounts_check"
  CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "discount_pct" BETWEEN 0 AND 100 AND "gst_pct" BETWEEN 0 AND 40 AND "total" >= 0);
ALTER TABLE "charges" ADD CONSTRAINT "charges_invoice_check" CHECK (("status" = 'invoiced') = ("invoice_id" IS NOT NULL));

-- Invoices: due on or after the invoice date, totals that add up.
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_dates_check" CHECK ("due_date" >= "invoice_date");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_totals_check"
  CHECK ("gross" >= 0 AND "discount" >= 0 AND "discount" <= "gross" AND "tax" >= 0 AND "total" = "gross" - "discount" + "tax");
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_amounts_check"
  CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "discount_pct" BETWEEN 0 AND 100 AND "gst_pct" BETWEEN 0 AND 40 AND "total" >= 0);

-- Payments and allocations: money received is positive; only a refund may release (negative) an allocation.
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("amount" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_purpose_check" CHECK ("purpose" IN ('charges', 'advance'));
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_amount_check"
  CHECK ("amount" <> 0 AND ("amount" > 0 OR "refund_id" IS NOT NULL));

-- Refunds: a positive amount; decision and completion times follow the status.
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_check" CHECK ("amount" > 0);
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_decision_check" CHECK (("status" = 'pending') = ("decided_at" IS NULL));
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_completion_check" CHECK (("status" IN ('processed', 'failed')) = ("completed_at" IS NOT NULL));
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_outcome_check" CHECK ("status" <> 'processed' OR "outcome_reference" IS NOT NULL);

-- Statements: a matched or candidate line points at a payment.
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_amount_check" CHECK ("amount" > 0);
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_payment_check" CHECK ("state" NOT IN ('matched', 'candidate') OR "payment_id" IS NOT NULL);
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_time_check" CHECK ("txn_time" IS NULL OR "txn_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Exceptions: a resolved exception carries its resolution.
ALTER TABLE "reconciliation_exceptions" ADD CONSTRAINT "reconciliation_exceptions_resolution_check"
  CHECK (("status" = 'resolved') = ("resolution_type" IS NOT NULL AND "resolution_note" IS NOT NULL AND "evidence" IS NOT NULL AND "resolved_at" IS NOT NULL));
