-- CreateEnum
CREATE TYPE "stock_location_kind" AS ENUM ('store', 'pharmacy');

-- CreateEnum
CREATE TYPE "stock_request_status" AS ENUM ('draft', 'submitted', 'approved', 'partially_approved', 'dispatched', 'partially_fulfilled', 'fulfilled', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "transfer_status" AS ENUM ('draft', 'ready', 'in_transit', 'received', 'cancelled');

-- CreateEnum
CREATE TYPE "goods_receipt_status" AS ENUM ('draft', 'reconciliation_required', 'ready_to_post', 'posted');

-- CreateEnum
CREATE TYPE "adjustment_status" AS ENUM ('draft', 'posted', 'rejected');

-- CreateEnum
CREATE TYPE "pharmacy_case_status" AS ENUM ('draft', 'awaiting_review', 'resolved', 'rejected');

-- CreateTable
CREATE TABLE "stock_items" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "unit" VARCHAR(30) NOT NULL,
    "unit_plural" VARCHAR(30) NOT NULL,
    "dosage_form" VARCHAR(80),
    "brand" VARCHAR(160),
    "pack" VARCHAR(80),
    "storage" VARCHAR(120),
    "schedule" VARCHAR(4),
    "medicine_code" VARCHAR(60),
    "strength" VARCHAR(40),
    "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "safety_level" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "target_level" INTEGER NOT NULL DEFAULT 0,
    "preferred_supplier_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "detail" VARCHAR(160) NOT NULL DEFAULT '',
    "kind" "stock_location_kind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" VARCHAR(20),
    "name" VARCHAR(160) NOT NULL,
    "contact" VARCHAR(120) NOT NULL DEFAULT '',
    "phone" VARCHAR(30) NOT NULL DEFAULT '',
    "email" VARCHAR(254) NOT NULL DEFAULT '',
    "categories" VARCHAR(40)[],
    "address" VARCHAR(240) NOT NULL DEFAULT '',
    "city" VARCHAR(80) NOT NULL DEFAULT '',
    "state" VARCHAR(80) NOT NULL DEFAULT '',
    "postal" VARCHAR(12) NOT NULL DEFAULT '',
    "country" VARCHAR(80) NOT NULL DEFAULT '',
    "gstin" VARCHAR(15) NOT NULL DEFAULT '',
    "registration" VARCHAR(80) NOT NULL DEFAULT '',
    "terms" VARCHAR(40) NOT NULL DEFAULT '',
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_item_suppliers" (
    "item_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,

    CONSTRAINT "stock_item_suppliers_pkey" PRIMARY KEY ("item_id","supplier_id")
);

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "batch_no" VARCHAR(40) NOT NULL,
    "expiry" DATE NOT NULL,
    "posted" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "quarantine" INTEGER NOT NULL DEFAULT 0,
    "bin" VARCHAR(40) NOT NULL DEFAULT '',

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "batch_id" UUID,
    "kind" VARCHAR(40) NOT NULL,
    "reference" VARCHAR(30) NOT NULL,
    "batch_label" VARCHAR(200) NOT NULL,
    "delta" INTEGER NOT NULL,
    "available_after" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_events" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "entity_type" VARCHAR(30) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_requests" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "location_id" UUID NOT NULL,
    "priority" VARCHAR(20) NOT NULL,
    "required_by" DATE,
    "reason" VARCHAR(120) NOT NULL,
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "status" "stock_request_status" NOT NULL DEFAULT 'draft',
    "decision" VARCHAR(40),
    "decision_note" VARCHAR(1000),
    "requested_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "stock_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_request_lines" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "requested" INTEGER NOT NULL,
    "approved" INTEGER NOT NULL DEFAULT 0,
    "issued" INTEGER NOT NULL DEFAULT 0,
    "received" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stock_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL,
    "request_line_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "transfer_id" UUID,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "request_id" UUID,
    "from_location_id" UUID NOT NULL,
    "to_location_id" UUID NOT NULL,
    "status" "transfer_status" NOT NULL DEFAULT 'draft',
    "reason" VARCHAR(120) NOT NULL,
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "planned_on" DATE,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ(6),
    "received_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_lines" (
    "id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "batch_no" VARCHAR(40) NOT NULL,
    "expiry" DATE NOT NULL,
    "qty" INTEGER NOT NULL,
    "received" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "ordered_on" DATE NOT NULL,
    "expected_on" DATE,
    "supplier_ref" VARCHAR(80) NOT NULL DEFAULT '',
    "terms" VARCHAR(40) NOT NULL DEFAULT '',
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "draft" BOOLEAN NOT NULL DEFAULT false,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "ordered" INTEGER NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "order_id" UUID,
    "supplier_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "challan" VARCHAR(80) NOT NULL DEFAULT '',
    "invoice" VARCHAR(80) NOT NULL DEFAULT '',
    "bay" VARCHAR(40) NOT NULL DEFAULT '',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "attachments" INTEGER NOT NULL DEFAULT 0,
    "status" "goods_receipt_status" NOT NULL DEFAULT 'draft',
    "received_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "ordered" INTEGER NOT NULL DEFAULT 0,
    "received" INTEGER NOT NULL,
    "rejected" INTEGER NOT NULL DEFAULT 0,
    "batches" JSONB NOT NULL,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_discrepancies" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "kind" VARCHAR(60) NOT NULL,
    "qty" INTEGER NOT NULL,
    "state" VARCHAR(20) NOT NULL,
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "resolution" VARCHAR(120),

    CONSTRAINT "receipt_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "item_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "proposed" INTEGER NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "evidence" VARCHAR(300) NOT NULL,
    "status" "adjustment_status" NOT NULL DEFAULT 'draft',
    "recorded_by" UUID NOT NULL,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispenses" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "prescription_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "register_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "consent_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "dispensed_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispense_lines" (
    "id" UUID NOT NULL,
    "dispense_id" UUID NOT NULL,
    "prescription_item_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "batch_no" VARCHAR(40) NOT NULL,
    "expiry" DATE NOT NULL,
    "bin" VARCHAR(40) NOT NULL DEFAULT '',
    "qty" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "dispense_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_cases" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "subtype" VARCHAR(60) NOT NULL,
    "item_id" UUID NOT NULL,
    "batch_id" UUID,
    "qty" INTEGER NOT NULL,
    "origin" VARCHAR(120) NOT NULL,
    "origin_note" VARCHAR(160) NOT NULL DEFAULT '',
    "reason" VARCHAR(120) NOT NULL,
    "reason_note" VARCHAR(160) NOT NULL DEFAULT '',
    "location" VARCHAR(120) NOT NULL,
    "expected" INTEGER,
    "observed" INTEGER,
    "notes" VARCHAR(2000) NOT NULL DEFAULT '',
    "evidence" INTEGER NOT NULL DEFAULT 0,
    "status" "pharmacy_case_status" NOT NULL DEFAULT 'awaiting_review',
    "status_note" VARCHAR(200) NOT NULL DEFAULT '',
    "assignee_id" UUID,
    "reported_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pharmacy_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_items_org_id_medicine_code_idx" ON "stock_items"("org_id", "medicine_code");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_org_id_code_key" ON "stock_items"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "stock_locations_org_id_code_key" ON "stock_locations"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_org_id_name_key" ON "suppliers"("org_id", "name");

-- CreateIndex
CREATE INDEX "stock_batches_org_id_location_id_idx" ON "stock_batches"("org_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_batches_item_id_location_id_batch_no_key" ON "stock_batches"("item_id", "location_id", "batch_no");

-- CreateIndex
CREATE INDEX "stock_movements_org_id_created_at_idx" ON "stock_movements"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_item_id_location_id_idx" ON "stock_movements"("item_id", "location_id");

-- CreateIndex
CREATE INDEX "inventory_events_org_id_entity_type_entity_id_created_at_idx" ON "inventory_events"("org_id", "entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_requests_org_id_reference_key" ON "stock_requests"("org_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "stock_request_lines_request_id_item_id_key" ON "stock_request_lines"("request_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_org_id_reference_key" ON "stock_transfers"("org_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_org_id_reference_key" ON "purchase_orders"("org_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_lines_order_id_item_id_key" ON "purchase_order_lines"("order_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_org_id_reference_key" ON "goods_receipts"("org_id", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_org_id_reference_key" ON "stock_adjustments"("org_id", "reference");

-- CreateIndex
CREATE INDEX "dispenses_prescription_id_idx" ON "dispenses"("prescription_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispenses_org_id_reference_key" ON "dispenses"("org_id", "reference");

-- CreateIndex
CREATE INDEX "dispense_lines_prescription_item_id_idx" ON "dispense_lines"("prescription_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_cases_org_id_reference_key" ON "pharmacy_cases"("org_id", "reference");

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_preferred_supplier_id_fkey" FOREIGN KEY ("preferred_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_item_suppliers" ADD CONSTRAINT "stock_item_suppliers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_item_suppliers" ADD CONSTRAINT "stock_item_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "stock_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_request_lines" ADD CONSTRAINT "stock_request_lines_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "stock_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_request_lines" ADD CONSTRAINT "stock_request_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_request_line_id_fkey" FOREIGN KEY ("request_line_id") REFERENCES "stock_request_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "stock_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_discrepancies" ADD CONSTRAINT "receipt_discrepancies_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispenses" ADD CONSTRAINT "dispenses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispenses" ADD CONSTRAINT "dispenses_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispenses" ADD CONSTRAINT "dispenses_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispenses" ADD CONSTRAINT "dispenses_dispensed_by_fkey" FOREIGN KEY ("dispensed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_lines" ADD CONSTRAINT "dispense_lines_dispense_id_fkey" FOREIGN KEY ("dispense_id") REFERENCES "dispenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispense_lines" ADD CONSTRAINT "dispense_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_cases" ADD CONSTRAINT "pharmacy_cases_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_cases" ADD CONSTRAINT "pharmacy_cases_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_cases" ADD CONSTRAINT "pharmacy_cases_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_cases" ADD CONSTRAINT "pharmacy_cases_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Rules the database enforces itself (not expressible in the Prisma schema) ──

-- Batches: stock is never negative, and reserved plus quarantined never exceed what is posted.
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_quantities_check"
  CHECK ("posted" >= 0 AND "reserved" >= 0 AND "quarantine" >= 0 AND "reserved" + "quarantine" <= "posted");

-- Items: sensible levels and price, and a recognised drug schedule.
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_levels_check"
  CHECK ("safety_level" >= 0 AND "reorder_level" >= 0 AND "target_level" >= 0 AND "unit_price" >= 0);
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_schedule_check" CHECK ("schedule" IS NULL OR "schedule" IN ('H', 'H1', 'X'));

-- Requests, transfers, orders: positive quantities, and a request line never approves, issues or receives more than asked.
ALTER TABLE "stock_request_lines" ADD CONSTRAINT "stock_request_lines_quantities_check"
  CHECK ("requested" > 0 AND "approved" BETWEEN 0 AND "requested" AND "issued" >= 0 AND "received" >= 0);
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_qty_check" CHECK ("qty" > 0);
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_locations_check" CHECK ("from_location_id" <> "to_location_id");
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_qty_check" CHECK ("qty" > 0 AND "received" BETWEEN 0 AND "qty");
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_qty_check" CHECK ("ordered" > 0 AND "rate" >= 0);

-- Receipts and adjustments.
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_qty_check" CHECK ("received" >= 0 AND "rejected" BETWEEN 0 AND "received");
ALTER TABLE "receipt_discrepancies" ADD CONSTRAINT "receipt_discrepancies_state_check" CHECK ("state" IN ('Unresolved', 'Documented', 'Resolved') AND "qty" >= 0);
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_qty_check" CHECK ("proposed" <> 0);
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_decision_check" CHECK (("status" = 'draft') = ("decided_at" IS NULL));

-- Dispensing and cases.
ALTER TABLE "dispense_lines" ADD CONSTRAINT "dispense_lines_qty_check" CHECK ("qty" > 0 AND "unit_price" >= 0);
ALTER TABLE "pharmacy_cases" ADD CONSTRAINT "pharmacy_cases_type_check" CHECK ("type" IN ('Return', 'Discrepancy') AND "qty" >= 0);
