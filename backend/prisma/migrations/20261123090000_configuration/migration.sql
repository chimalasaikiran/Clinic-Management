-- CreateEnum
CREATE TYPE "closure_kind" AS ENUM ('closed', 'special');

-- CreateEnum
CREATE TYPE "department_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "insurance_partner_type" AS ENUM ('insurer', 'tpa');

-- CreateEnum
CREATE TYPE "agreement_status" AS ENUM ('draft', 'active', 'ended');

-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "accepts_insurance" BOOLEAN,
ADD COLUMN     "classification" VARCHAR(60),
ADD COLUMN     "email" VARCHAR(254),
ADD COLUMN     "logo_id" UUID,
ADD COLUMN     "phone" VARCHAR(15),
ADD COLUMN     "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "structure" VARCHAR(60);

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "address_line1" VARCHAR(240),
ADD COLUMN     "address_line2" VARCHAR(240),
ADD COLUMN     "country" VARCHAR(60) NOT NULL DEFAULT 'India',
ADD COLUMN     "email" VARCHAR(254),
ADD COLUMN     "facility_type" VARCHAR(80),
ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" VARCHAR(15),
ADD COLUMN     "pin_code" CHAR(6);

-- CreateTable
CREATE TABLE "branch_hours" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start" VARCHAR(5) NOT NULL,
    "end" VARCHAR(5) NOT NULL,
    "label" VARCHAR(60) NOT NULL DEFAULT '',

    CONSTRAINT "branch_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_closures" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "kind" "closure_kind" NOT NULL,
    "opens_at" VARCHAR(5),
    "closes_at" VARCHAR(5),
    "reason" VARCHAR(240) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "description" VARCHAR(1000) NOT NULL DEFAULT '',
    "status" "department_status" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_branches" (
    "department_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,

    CONSTRAINT "department_branches_pkey" PRIMARY KEY ("department_id","branch_id")
);

-- CreateTable
CREATE TABLE "insurance_partners" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "type" "insurance_partner_type" NOT NULL,
    "listed" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_documents" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_agreements" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "insurer_id" UUID NOT NULL,
    "tpa_id" UUID,
    "reference" VARCHAR(80) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "agreement_status" NOT NULL DEFAULT 'draft',
    "document_id" UUID,
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "methods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverage" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "activated_by" UUID,
    "activated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "insurance_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_agreement_branches" (
    "agreement_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,

    CONSTRAINT "insurance_agreement_branches_pkey" PRIMARY KEY ("agreement_id","branch_id")
);

-- CreateIndex
CREATE INDEX "branch_hours_branch_id_weekday_idx" ON "branch_hours"("branch_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "branch_closures_branch_id_date_key" ON "branch_closures"("branch_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "departments_org_id_code_key" ON "departments"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_org_id_name_key" ON "departments"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_partners_org_id_type_name_key" ON "insurance_partners"("org_id", "type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_agreements_org_id_code_key" ON "insurance_agreements"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_agreements_org_id_reference_key" ON "insurance_agreements"("org_id", "reference");

-- AddForeignKey
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_logo_id_fkey" FOREIGN KEY ("logo_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_hours" ADD CONSTRAINT "branch_hours_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_closures" ADD CONSTRAINT "branch_closures_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_closures" ADD CONSTRAINT "branch_closures_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_branches" ADD CONSTRAINT "department_branches_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_branches" ADD CONSTRAINT "department_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_partners" ADD CONSTRAINT "insurance_partners_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_documents" ADD CONSTRAINT "insurance_documents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_documents" ADD CONSTRAINT "insurance_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_agreements" ADD CONSTRAINT "insurance_agreements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_agreements" ADD CONSTRAINT "insurance_agreements_insurer_id_fkey" FOREIGN KEY ("insurer_id") REFERENCES "insurance_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_agreements" ADD CONSTRAINT "insurance_agreements_tpa_id_fkey" FOREIGN KEY ("tpa_id") REFERENCES "insurance_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_agreements" ADD CONSTRAINT "insurance_agreements_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "insurance_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_agreements" ADD CONSTRAINT "insurance_agreements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_agreements" ADD CONSTRAINT "insurance_agreements_activated_by_fkey" FOREIGN KEY ("activated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_agreement_branches" ADD CONSTRAINT "insurance_agreement_branches_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "insurance_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_agreement_branches" ADD CONSTRAINT "insurance_agreement_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Existing data ─────────────────────────────────────────────────────────

-- Each organisation's first branch (created with it) is its primary branch.
UPDATE "branches" b SET "is_primary" = true
WHERE b.id = (SELECT f.id FROM "branches" f WHERE f.org_id = b.org_id ORDER BY f.created_at, f.id LIMIT 1);

-- The departments already named on staff, doctors and services become the master list, available at every branch.
INSERT INTO "departments" ("id", "org_id", "code", "name", "type", "status", "updated_at")
SELECT gen_random_uuid(), named.org_id, 'DEP-' || lpad(row_number() OVER (PARTITION BY named.org_id ORDER BY named.name)::text, 3, '0'), named.name, 'Clinical', 'active', now()
FROM (
  SELECT DISTINCT org_id, btrim(department) AS name FROM "staff_members" WHERE btrim(department) <> ''
  UNION SELECT DISTINCT org_id, btrim(department) FROM "practitioners" WHERE btrim(department) <> ''
  UNION SELECT DISTINCT org_id, btrim(department) FROM "billing_services" WHERE department IS NOT NULL AND btrim(department) <> ''
) named;

INSERT INTO "department_branches" ("department_id", "branch_id")
SELECT d.id, b.id FROM "departments" d JOIN "branches" b ON b.org_id = d.org_id;

-- ─── Rules the application also checks, kept here so no other writer can break them ─

ALTER TABLE "branches" ADD CONSTRAINT "branches_pin_code" CHECK ("pin_code" IS NULL OR "pin_code" ~ '^[1-9][0-9]{5}$');
CREATE UNIQUE INDEX "branches_one_primary" ON "branches" ("org_id") WHERE "is_primary";
ALTER TABLE "branch_hours" ADD CONSTRAINT "branch_hours_session" CHECK ("weekday" BETWEEN 0 AND 6 AND "start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "end" ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' AND "start" < "end");
ALTER TABLE "branch_closures" ADD CONSTRAINT "branch_closures_times" CHECK (("kind" = 'closed' AND "opens_at" IS NULL AND "closes_at" IS NULL) OR ("kind" = 'special' AND "opens_at" IS NOT NULL AND "closes_at" IS NOT NULL AND "opens_at" < "closes_at"));
ALTER TABLE "insurance_documents" ADD CONSTRAINT "insurance_documents_size" CHECK ("size" > 0 AND "size" <= 10485760);
ALTER TABLE "insurance_agreements" ADD CONSTRAINT "insurance_agreements_dates" CHECK ("end_date" >= "start_date");
ALTER TABLE "insurance_agreements" ADD CONSTRAINT "insurance_agreements_activated" CHECK ("status" = 'draft' OR "activated_at" IS NOT NULL);

