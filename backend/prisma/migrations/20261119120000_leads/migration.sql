-- CreateEnum
CREATE TYPE "lead_stage" AS ENUM ('new', 'contacted', 'qualified', 'converted', 'closed');

-- CreateEnum
CREATE TYPE "lead_source" AS ENUM ('website', 'phone', 'front_desk', 'walk_in');

-- CreateEnum
CREATE TYPE "lead_activity_kind" AS ENUM ('created', 'updated', 'interaction', 'converted', 'disposition');

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "branch_id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "mobile" VARCHAR(10) NOT NULL,
    "email" VARCHAR(254),
    "interest" VARCHAR(120),
    "source" "lead_source" NOT NULL,
    "stage" "lead_stage" NOT NULL DEFAULT 'new',
    "owner_membership_id" UUID NOT NULL,
    "next_action" VARCHAR(200),
    "next_due_at" TIMESTAMPTZ(6),
    "patient_id" UUID,
    "converted_at" TIMESTAMPTZ(6),
    "converted_by" UUID,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "kind" "lead_activity_kind" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "details" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "owner_membership_id" UUID,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_org_id_branch_id_stage_idx" ON "leads"("org_id", "branch_id", "stage");

-- CreateIndex
CREATE INDEX "leads_org_id_mobile_idx" ON "leads"("org_id", "mobile");

-- CreateIndex
CREATE INDEX "leads_org_id_next_due_at_idx" ON "leads"("org_id", "next_due_at");

-- CreateIndex
CREATE INDEX "leads_org_id_created_at_idx" ON "leads"("org_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "leads_org_id_number_key" ON "leads"("org_id", "number");

-- CreateIndex
CREATE INDEX "lead_activities_lead_id_occurred_at_idx" ON "lead_activities"("lead_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_by_fkey" FOREIGN KEY ("converted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Guards the application also enforces, kept in the database so no write path can break them.
ALTER TABLE "leads" ADD CONSTRAINT "leads_mobile_format" CHECK ("mobile" ~ '^[6-9][0-9]{9}$');
-- A lead is converted exactly when it is linked to a patient; converted and closed leads have no open follow-up.
ALTER TABLE "leads" ADD CONSTRAINT "leads_conversion_check"
  CHECK (("stage" = 'converted') = ("patient_id" IS NOT NULL AND "converted_at" IS NOT NULL)
    AND ("stage" NOT IN ('converted', 'closed') OR "next_due_at" IS NULL));
ALTER TABLE "leads" ADD CONSTRAINT "leads_follow_up_check" CHECK ("next_due_at" IS NULL OR "next_action" IS NOT NULL);

-- New permission for adding leads and recording follow-ups. Owner-level (system) roles hold every permission.
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT "id", 'growth.leads' FROM "roles" WHERE "is_system" = true
ON CONFLICT DO NOTHING;
